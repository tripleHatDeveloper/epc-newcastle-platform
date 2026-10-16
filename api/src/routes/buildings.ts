import { Router } from "express";
import { query } from "../db/client.js";

export const buildingsRouter = Router();

// GET /api/buildings?zone=&band=&propertyType=&minFloorArea=&issuedAfter=
// Public, no auth. Deliberately never returns `status` — validation
// status is an internal admin concern, not surfaced on the public viewer.
buildingsRouter.get("/", async (req, res) => {
  const { zone, band, propertyType, minFloorArea, issuedAfter } = req.query;

  const conditions: string[] = [];
  const params: any[] = [];

  if (zone) {
    params.push(zone);
    conditions.push(`zone = $${params.length}`);
  }
  if (band) {
    // `band` may be a single letter ("F") or several comma-separated ("A,D,E")
    // to support selecting a mixed subset of bands rather than only one.
    const bandList = String(band)
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);
    params.push(bandList);
    conditions.push(`epc_band = ANY($${params.length})`);
  }
  if (propertyType) {
    params.push(`%${propertyType}%`);
    conditions.push(`property_type ILIKE $${params.length}`);
  }
  // A threshold of 0 is treated the same as "no constraint" — the query
  // param arrives as the string "0", which is truthy in JS (only an empty
  // string is falsy), so a plain `if (minFloorArea)` check would still
  // apply `floor_area_sqm >= 0`. Since NULL >= 0 evaluates to NULL (not
  // true) in SQL, that silently excluded every building with no recorded
  // floor area at all — the vast majority of buildings — even when the
  // slider was at its minimum, which is the opposite of what "0" should
  // mean. Confirmed directly against a real database before fixing this.
  const minFloorAreaValue = minFloorArea ? Number(minFloorArea) : 0;
  if (minFloorAreaValue > 0) {
    params.push(minFloorAreaValue);
    conditions.push(`floor_area_sqm >= $${params.length}`);
  }
  if (issuedAfter) {
    // A plain date (YYYY-MM-DD) computed client-side from a "last N
    // days/months/years" picker — kept as a simple date comparison here
    // rather than the server doing any date arithmetic itself.
    params.push(issuedAfter);
    conditions.push(`epc_inspection_date >= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await query(
    `SELECT uprn, address, zone, property_type, floor_area_sqm, epc_band,
            osm_feature_id, ST_X(geom) AS lng, ST_Y(geom) AS lat
     FROM hereditaments
     ${where}
     ORDER BY address`,
    params
  );

  res.json(rows);
});

// GET /api/buildings/:uprn — full detail for the building panel, including
// its recommendations. Still no status field.
buildingsRouter.get("/:uprn", async (req, res) => {
  const uprn = Number(req.params.uprn);

  const [building] = await query(
    `SELECT uprn, address, zone, property_type, floor_area_sqm, epc_band,
            epc_inspection_date
     FROM hereditaments WHERE uprn = $1`,
    [uprn]
  );

  if (!building) {
    return res.status(404).json({ error: "No building found with that reference." });
  }

  const recommendations = await query(
    `SELECT id, measure, payback_category, estimated_cost
     FROM recommendations WHERE uprn = $1`,
    [uprn]
  );

  res.json({ ...building, recommendations });
});
