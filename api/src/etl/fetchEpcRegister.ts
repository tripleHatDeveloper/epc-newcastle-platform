// Pulls domestic and non-domestic EPC certificates for Newcastle upon Tyne
// from the Energy Certificate Data API on
// https://api.get-energy-performance-data.communities.gov.uk (the successor
// to the retired epc.opendatacommunities.org, as of 30 May 2026). Access is
// via a bearer token from GOV.UK One Login — see EPC_API_KEY in .env, and
// README "Before you start" for how to obtain one.
//
// Everything below has been verified against real API responses (as of
// September 2026) — none of this is guessed.
//
// 1. The /api/{domestic,non-domestic}/search endpoints return only address,
//    band, registration date, UPRN, and (non-domestic only) `relatedRrn` —
//    NOT floor area or property type. Getting those requires a second call
//    per certificate to /api/certificate. Confirmed fields on that full
//    response: `property_type` (top-level string) and
//    `technical_information.floor_area` (a number, NOT a top-level
//    `total_floor_area`/`floor_area` field as originally guessed).
//
// 2. There is no per-building recommendations endpoint. Recommendations are
//    only available as a bulk file download, and the real shape is quite
//    different from what a "recommendations dataset" name suggests:
//      - The download endpoint is plural — /api/files/non-domestic-recommendations/json
//        (the docs describe it as singular; that URL 404s in practice).
//      - The zip contains one file per year (certificates-2011.json etc.),
//        each in JSON LINES format — one JSON object per line, not a single
//        parseable JSON document or a {"data": [...]} wrapper.
//      - Each line's actual recommendation content is a JSON STRING under a
//        `document` key, requiring a second JSON.parse.
//      - Inside that parsed document: `short_payback` / `medium_payback` /
//        `long_payback` arrays, each entry shaped as
//        { recommendation, recommendation_code, co2_impact } — there is no
//        cost/saving estimate anywhere in this dataset. That's a genuine
//        limitation of the data, not a gap in this code — it reinforces the
//        original brief's caveat that recommendation costs need
//        building-by-building verification; `estimated_cost` will
//        legitimately stay null until an admin adds one manually.
//      - The join key back to a hereditament is `related_certificate_number`
//        inside that parsed document, which matches the building's
//        `relatedRrn` from the non-domestic search response (confirmed: a
//        search result's `relatedRrn` equals the recommendations report's
//        own outer `certificate_number`, whose parsed `document.related_certificate_number`
//        points back to the original EPC certificate number).

import AdmZip from "adm-zip";

const API_BASE = "https://api.get-energy-performance-data.communities.gov.uk";
const COUNCIL = "Newcastle upon Tyne";
const BANDS = ["C", "D", "E", "F", "G"];
const NON_DOMESTIC_MIN_FLOOR_AREA_SQM = 1000;
// Confirmed against real data: this API returns at least two variants of
// the same category — "B1 Offices and Workshop businesses" and "Offices
// and Workshop Businesses" (different capitalisation, no "B1" prefix). A
// case-insensitive substring match on the stable core phrase catches both,
// rather than depending on an exact string that only matches some records.
const NON_DOMESTIC_PROPERTY_TYPE_FILTER = /offices and workshop/i;

export interface EpcRecord {
  uprn: number;
  address: string;
  postcode: string;
  propertyType: string;
  floorAreaSqm: number | null;
  band: string;
  inspectionDate: string;
  certificateNumber: string;
  recommendations: { measure: string; paybackCategory: string; estimatedCost?: number }[];
}

function authHeaders() {
  if (!process.env.EPC_API_KEY) {
    throw new Error(
      "EPC_API_KEY is not set. See README 'Before you start' for how to register and obtain one."
    );
  }
  return {
    Authorization: `Bearer ${process.env.EPC_API_KEY}`,
    Accept: "application/json",
  };
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// EPCs are valid for 10 years — only fetch certificates still within that window.
export function tenYearWindow(referenceDate: Date = new Date()) {
  const end = new Date(referenceDate);
  end.setDate(end.getDate() - 1); // API rejects date_end === today
  const start = new Date(end);

  // Optional override for a quick, bounded test run (e.g. ETL_LOOKBACK_DAYS=30)
  // rather than pulling the full 10-year history on every run while testing.
  // Default (no env var set) is unchanged: exactly 10 years.
  const overrideDays = process.env.ETL_LOOKBACK_DAYS ? Number(process.env.ETL_LOOKBACK_DAYS) : null;
  if (overrideDays) {
    start.setDate(start.getDate() - overrideDays);
  } else {
    start.setFullYear(start.getFullYear() - 10);
  }

  return { dateStart: isoDate(start), dateEnd: isoDate(end) };
}

interface SearchResultRow {
  certificateNumber: string;
  addressLine1: string;
  addressLine2?: string;
  postTown: string;
  postcode: string;
  currentEnergyEfficiencyBand: string;
  registrationDate: string;
  uprn: number;
  relatedRrn?: string; // non-domestic only — the linked recommendations report's certificate number
}

async function searchCertificates(
  kind: "domestic" | "non-domestic",
  dateStart: string,
  dateEnd: string
): Promise<SearchResultRow[]> {
  const results: SearchResultRow[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams();
    params.append("council[]", COUNCIL);
    for (const band of BANDS) params.append("efficiency_rating[]", band);
    params.set("date_start", dateStart);
    params.set("date_end", dateEnd);
    params.set("current_page", String(page));
    params.set("page_size", "5000");

    const res = await fetch(`${API_BASE}/api/${kind}/search?${params}`, {
      headers: authHeaders(),
    });

    if (res.status === 404) break; // no (more) results
    if (res.status === 429) {
      // Rate limited — back off briefly and retry this page rather than
      // batching aggressively, per the API's guidance.
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    if (!res.ok) {
      throw new Error(`EPC ${kind} search failed: ${res.status} ${await res.text()}`);
    }

    const body = await res.json();
    results.push(...body.data);

    if (!body.pagination?.nextPage) break;
    page = body.pagination.nextPage;
  }

  return results;
}

// Fetches the full certificate record — needed for non-domestic filtering
// since the search endpoint omits floor area and property type.
async function fetchFullCertificate(certificateNumber: string): Promise<any> {
  const params = new URLSearchParams({ certificate_number: certificateNumber });
  const res = await fetch(`${API_BASE}/api/certificate?${params}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`Fetching certificate ${certificateNumber} failed: ${res.status}`);
  }
  const body = await res.json();
  return body.data;
}

type PaybackCategory = "short" | "medium" | "long";

const PAYBACK_ARRAY_KEYS: Record<PaybackCategory, string> = {
  short: "short_payback",
  medium: "medium_payback",
  long: "long_payback",
};

// Parses a single line of the bulk recommendations file (JSON Lines format).
// Extracted as a pure function so it's independently testable against a
// real captured sample line, without needing to download the actual file.
export function parseRecommendationLine(
  line: string
): { originalCertificateNumber: string; recommendations: { measure: string; paybackCategory: PaybackCategory }[] } | null {
  if (!line.trim()) return null;

  let outer: { certificate_number: string; document: string };
  try {
    outer = JSON.parse(line);
  } catch {
    return null; // malformed/truncated line — skip rather than fail the whole run
  }

  const doc = JSON.parse(outer.document);
  const originalCertificateNumber: string = doc.related_certificate_number;

  const recommendations: { measure: string; paybackCategory: PaybackCategory }[] = [];
  for (const [category, arrayKey] of Object.entries(PAYBACK_ARRAY_KEYS) as [
    PaybackCategory,
    string
  ][]) {
    for (const item of doc[arrayKey] ?? []) {
      recommendations.push({ measure: item.recommendation, paybackCategory: category });
    }
  }

  return { originalCertificateNumber, recommendations };
}

// Downloads the bulk non-domestic recommendations dataset and returns only
// the entries relevant to the given set of relatedRrn values, so we're not
// holding the entire (250MB+) national dataset in memory longer than needed.
// Only processes year-files within the given date window, since our own
// hereditament EPCs can't fall outside it either.
async function fetchNonDomesticRecommendations(
  relevantRrns: Set<string>,
  yearRange: { startYear: number; endYear: number }
): Promise<Map<string, { measure: string; paybackCategory: PaybackCategory }[]>> {
  const redirectRes = await fetch(
    `${API_BASE}/api/files/non-domestic-recommendations/json`,
    { headers: authHeaders(), redirect: "manual" }
  );
  const fileUrl = redirectRes.headers.get("location");
  if (!fileUrl) {
    throw new Error("Could not resolve the non-domestic recommendations download URL.");
  }

  const zipRes = await fetch(fileUrl); // pre-signed S3 URL, no auth header needed, expires quickly
  const zipBuffer = Buffer.from(await zipRes.arrayBuffer());
  const zip = new AdmZip(zipBuffer);

  const byRrn = new Map<string, { measure: string; paybackCategory: PaybackCategory }[]>();

  for (const entry of zip.getEntries()) {
    const yearMatch = entry.entryName.match(/certificates-(\d{4})\.json$/);
    if (!yearMatch) continue;
    const year = Number(yearMatch[1]);
    if (year < yearRange.startYear || year > yearRange.endYear) continue; // skip irrelevant years

    const text = entry.getData().toString("utf-8");
    for (const line of text.split("\n")) {
      // Cheap pre-check on the raw line avoids parsing JSON for entries we
      // don't care about — only lines mentioning a relevant RRN get parsed.
      const relevant = [...relevantRrns].some((rrn) => line.includes(rrn));
      if (!relevant) continue;

      const parsed = parseRecommendationLine(line);
      if (!parsed) continue;

      byRrn.set(parsed.originalCertificateNumber, parsed.recommendations);
    }
  }

  return byRrn;
}

export async function fetchEpcRegister(): Promise<EpcRecord[]> {
  const { dateStart, dateEnd } = tenYearWindow();

  const [domesticRows, nonDomesticRows] = await Promise.all([
    searchCertificates("domestic", dateStart, dateEnd),
    searchCertificates("non-domestic", dateStart, dateEnd),
  ]);

  const records: EpcRecord[] = [];

  // Domestic: no floor-area/property-type filter from the original brief —
  // that criterion applied specifically to the non-domestic pilot.
  // Confirmed against real data (a full 10-year pull surfaced this): some
  // domestic EPC records genuinely have no UPRN at all in the government
  // dataset. Since uprn is our primary key, such a record can never be
  // stored — skip it here rather than let it reach the database and
  // crash the whole run on a NOT NULL violation partway through
  // processing tens of thousands of records.
  let skippedNoUprn = 0;
  for (const row of domesticRows) {
    if (!row.uprn) {
      skippedNoUprn++;
      continue;
    }
    records.push({
      uprn: row.uprn,
      address: [row.addressLine1, row.addressLine2, row.postTown].filter(Boolean).join(", "),
      postcode: row.postcode,
      propertyType: "Domestic",
      floorAreaSqm: null,
      band: row.currentEnergyEfficiencyBand,
      inspectionDate: row.registrationDate,
      certificateNumber: row.certificateNumber,
      recommendations: [],
    });
  }
  if (skippedNoUprn > 0) {
    console.warn(`Skipped ${skippedNoUprn} domestic record(s) with no UPRN in the source data.`);
  }

  // Non-domestic: apply the original inclusion criteria, which needs the
  // full certificate record (floor area, property type) per candidate.
  const qualifying: { row: SearchResultRow; full: any }[] = [];
  for (const row of nonDomesticRows) {
    const full = await fetchFullCertificate(row.certificateNumber);
    const floorArea = Number(full.technical_information?.floor_area ?? 0);
    const propertyType: string = full.property_type ?? "";

    if (
      floorArea > NON_DOMESTIC_MIN_FLOOR_AREA_SQM &&
      NON_DOMESTIC_PROPERTY_TYPE_FILTER.test(propertyType)
    ) {
      qualifying.push({ row, full });
    }
  }

  const relevantRrns = new Set(
    qualifying.map((q) => q.row.relatedRrn).filter((rrn): rrn is string => Boolean(rrn))
  );
  const recommendationsByCertNumber = await fetchNonDomesticRecommendations(relevantRrns, {
    startYear: Number(dateStart.slice(0, 4)),
    endYear: Number(dateEnd.slice(0, 4)),
  });

  let skippedNonDomesticNoUprn = 0;
  for (const { row, full } of qualifying) {
    if (!row.uprn) {
      skippedNonDomesticNoUprn++;
      continue;
    }
    records.push({
      uprn: row.uprn,
      address: [row.addressLine1, row.addressLine2, row.postTown].filter(Boolean).join(", "),
      postcode: row.postcode,
      propertyType: full.property_type ?? "Non-domestic",
      floorAreaSqm: Number(full.technical_information?.floor_area ?? 0),
      band: row.currentEnergyEfficiencyBand,
      inspectionDate: row.registrationDate,
      certificateNumber: row.certificateNumber,
      recommendations: recommendationsByCertNumber.get(row.certificateNumber) ?? [],
    });
  }
  if (skippedNonDomesticNoUprn > 0) {
    console.warn(
      `Skipped ${skippedNonDomesticNoUprn} non-domestic record(s) with no UPRN in the source data.`
    );
  }

  return records;
}
