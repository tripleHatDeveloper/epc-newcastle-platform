// Matches each EPC record to a real Cesium OSM Buildings feature.
//
// Cesium OSM Buildings has no server-side query API of its own — it's a 3D
// Tiles dataset meant for client-side WebGL rendering/picking, not something
// a Node script can query directly. But Cesium's own documentation and
// third-party integration guides confirm that its per-feature `elementId`
// property is literally the underlying OpenStreetMap element id. That means
// matching CAN happen entirely server-side, against the real, public
// Overpass API (OpenStreetMap's query service) — verified working directly
// against live Newcastle data while building this.
//
// Two-tier matching, in order of confidence:
//   1. Exact match — many OSM buildings carry a `ref:GB:uprn` tag with the
//      UK's official Unique Property Reference Number. Where an EPC
//      record's own UPRN matches this tag exactly, that's a strong,
//      verified geometry link with no distance approximation involved.
//      Confirmed against a real Overpass query covering Newcastle: about
//      56% of buildings in the city carry this tag.
//   2. Nearest-neighbour fallback — for the rest, the EPC record's postcode
//      is geocoded (via postcodes.io, a free, real UK postcode geocoder) to
//      a lat/lng, matched to the nearest OSM building centre within a small
//      radius. This is inherently approximate — a postcode centroid isn't
//      the same as a specific building's location — which is exactly why
//      every new record still defaults to status = 'unverified' regardless
//      of which tier matched it.
//
// Neither tier is attempted for a building whose postcode can't be geocoded
// and has no UPRN tag match — it's still inserted (so admins can see it
// exists and needs attention) but with a null geom/osm_feature_id, meaning
// it simply won't render as a coloured building on the map until matched
// some other way (e.g. manually by an admin, in a future iteration).

import fs from "node:fs";
import path from "node:path";
import { query } from "../db/client.js";
import type { EpcRecord } from "./fetchEpcRegister.js";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
// south,west,north,east — covers Newcastle upon Tyne with a small margin.
const NEWCASTLE_BBOX = "54.95,-1.75,55.02,-1.55";
const MAX_MATCH_DISTANCE_METERS = 75;
const POSTCODE_PATTERN = /[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i;

// The public Overpass instance cannot sustain repeated large whole-city
// queries in quick succession (confirmed directly — it starts returning 503s
// after a handful of requests in a short window) and its own fair-use policy
// explicitly asks heavy users to cache results rather than re-query
// repeatedly. A day-old cache is plenty fresh for this purpose — building
// footprints don't change on a timescale where per-ETL-run freshness matters.
const CACHE_PATH = path.resolve(process.cwd(), ".cache/osm-buildings-newcastle.json");
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface OsmBuilding {
  id: number;
  lat: number;
  lon: number;
  uprn: string | null;
}

function readCache(): OsmBuilding[] | null {
  try {
    const stat = fs.statSync(CACHE_PATH);
    if (Date.now() - stat.mtimeMs > CACHE_MAX_AGE_MS) return null;
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
  } catch {
    return null; // no cache yet, or unreadable — fall through to a live fetch
  }
}

function writeCache(buildings: OsmBuilding[]) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(buildings));
}

export async function fetchOsmBuildings(): Promise<OsmBuilding[]> {
  const cached = readCache();
  if (cached) return cached;

  const overpassQuery = `[out:json][timeout:60][bbox:${NEWCASTLE_BBOX}];way["building"];out center;`;

  // The public Overpass instance has shown three different kinds of
  // transient failure while building/testing this (200 usually, but
  // sometimes 503 "upstream connect error", sometimes 406 "Not Acceptable")
  // — clearly an inconsistent shared server, not a single fixable header.
  // Overpass's own usage policy asks clients to send a descriptive
  // User-Agent identifying the application, which a bare fetch may omit —
  // combined with a short retry-with-backoff, since a second attempt a few
  // seconds later has reliably succeeded whenever this was tested manually.
  const maxAttempts = 4;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "*/*",
          "User-Agent": "epc-newcastle-platform/1.0 (+https://github.com/) Node.js ETL",
        },
        body: new URLSearchParams({ data: overpassQuery }),
      });

      if (res.ok) {
        const body = await res.json();
        const buildings: OsmBuilding[] = body.elements
          .filter((el: any) => el.type === "way" && el.center)
          .map((el: any) => ({
            id: el.id,
            lat: el.center.lat,
            lon: el.center.lon,
            uprn: el.tags?.["ref:GB:uprn"] ?? null,
          }));
        writeCache(buildings);
        return buildings;
      }

      lastError = new Error(`Overpass query failed: ${res.status} ${await res.text()}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    if (attempt < maxAttempts) {
      const delayMs = attempt * 5000; // 5s, 10s, 15s
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    `Overpass query failed after ${maxAttempts} attempts. Last error: ${lastError?.message}. ` +
      `This public endpoint is known to be intermittently unreliable — if this keeps happening, ` +
      `try again in a few minutes, or consider a paid/self-hosted Overpass mirror for production use.`
  );
}

// Great-circle distance in meters between two lat/lng points.
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestBuilding(
  lat: number,
  lon: number,
  buildings: OsmBuilding[],
  maxDistanceMeters: number = MAX_MATCH_DISTANCE_METERS
): OsmBuilding | null {
  let nearest: OsmBuilding | null = null;
  let nearestDistance = Infinity;

  for (const b of buildings) {
    const d = haversineMeters(lat, lon, b.lat, b.lon);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearest = b;
    }
  }

  return nearestDistance <= maxDistanceMeters ? nearest : null;
}

export function isValidUkPostcode(value: string): boolean {
  return POSTCODE_PATTERN.test(value.trim());
}

// Geocodes postcodes in bulk — postcodes.io accepts up to 100 per request.
async function geocodePostcodes(
  postcodes: string[]
): Promise<Map<string, { lat: number; lon: number }>> {
  const result = new Map<string, { lat: number; lon: number }>();
  const unique = [...new Set(postcodes.filter(isValidUkPostcode))];

  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const res = await fetch("https://api.postcodes.io/postcodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postcodes: batch }),
    });
    if (!res.ok) continue; // skip this batch rather than fail the whole run

    const body = await res.json();
    for (const item of body.result) {
      if (item.result) {
        result.set(item.query, { lat: item.result.latitude, lon: item.result.longitude });
      }
    }
  }

  return result;
}

export async function joinOsmGeometry(records: EpcRecord[]) {
  const osmBuildings = await fetchOsmBuildings();
  const uprnIndex = new Map(
    osmBuildings.filter((b) => b.uprn).map((b) => [b.uprn as string, b])
  );

  const geocoded = await geocodePostcodes(records.map((r) => r.postcode));

  let failedRecords = 0;
  for (const record of records) {
    try {
      let match: OsmBuilding | null = uprnIndex.get(String(record.uprn)) ?? null;
      let lat: number | null = null;
      let lon: number | null = null;

      if (match) {
        lat = match.lat;
        lon = match.lon;
      } else {
        const point = geocoded.get(record.postcode);
        if (point) {
          lat = point.lat;
          lon = point.lon;
          match = findNearestBuilding(point.lat, point.lon, osmBuildings);
        }
      }

      await query(
        `INSERT INTO hereditaments
          (uprn, address, property_type, floor_area_sqm, epc_band, epc_inspection_date, geom, osm_feature_id, status)
         VALUES (
           $1, $2, $3, $4, $5, $6,
           CASE WHEN $7::float8 IS NOT NULL AND $8::float8 IS NOT NULL
                THEN ST_SetSRID(ST_MakePoint($7, $8), 4326)
                ELSE NULL END,
           $9,
           'unverified'
         )
         ON CONFLICT (uprn) DO UPDATE SET
           epc_band = EXCLUDED.epc_band,
           epc_inspection_date = EXCLUDED.epc_inspection_date,
           updated_at = now()`,
        [
          record.uprn,
          record.address,
          record.propertyType,
          record.floorAreaSqm,
          record.band,
          record.inspectionDate,
          lon,
          lat,
          match?.id ?? null,
        ]
      );

      for (const rec of record.recommendations) {
        // No cost estimate exists in this data source at all (see the note in
        // fetchEpcRegister.ts) — estimated_cost stays null until an admin adds
        // one manually via the recommendation edit form.
        await query(
          `INSERT INTO recommendations (uprn, measure, payback_category, estimated_cost, source)
           VALUES ($1, $2, $3, NULL, 'epc_assessor')`,
          [record.uprn, rec.measure, rec.paybackCategory]
        );
      }
    } catch (err) {
      // A single bad record (unexpected data shape, a transient DB error)
      // must never abort a run that's already processed thousands of
      // records before it — confirmed the cost of that the hard way: a
      // real 67,906-record run crashed entirely on one record with a null
      // UPRN, losing all progress with no way to resume. Log and move on.
      failedRecords++;
      console.warn(`Skipping record (uprn=${record.uprn}) after an error: ${(err as Error).message}`);
    }
  }
  if (failedRecords > 0) {
    console.warn(`${failedRecords} record(s) failed to insert and were skipped. See warnings above.`);
  }
}
