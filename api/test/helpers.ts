import bcrypt from "bcryptjs";
import { query } from "../src/db/client.js";

export async function seedBuilding(overrides: Partial<Record<string, any>> = {}) {
  const defaults = {
    uprn: 100110192837,
    address: "14 Grainger Street",
    zone: "City centre",
    property_type: "Offices",
    floor_area_sqm: 1240,
    epc_band: "F",
    epc_inspection_date: "2022-01-01",
    lng: -1.6144,
    lat: 54.9738,
    osm_feature_id: 555,
    status: "unverified",
  };
  const row = { ...defaults, ...overrides };

  await query(
    `INSERT INTO hereditaments
      (uprn, address, zone, property_type, floor_area_sqm, epc_band, epc_inspection_date, geom, osm_feature_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326), $10, $11)`,
    [
      row.uprn,
      row.address,
      row.zone,
      row.property_type,
      row.floor_area_sqm,
      row.epc_band,
      row.epc_inspection_date,
      row.lng,
      row.lat,
      row.osm_feature_id,
      row.status,
    ]
  );

  return row;
}

export async function seedRecommendation(uprn: number, overrides: Partial<Record<string, any>> = {}) {
  const defaults = {
    measure: "LED lighting",
    payback_category: "medium",
    estimated_cost: 18500,
    source: "epc_assessor",
  };
  const row = { ...defaults, ...overrides };

  const [inserted] = await query(
    `INSERT INTO recommendations (uprn, measure, payback_category, estimated_cost, source)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [uprn, row.measure, row.payback_category, row.estimated_cost, row.source]
  );

  return { id: inserted.id, uprn, ...row };
}

export async function seedAdminUser(
  email = "admin@northumbria.ac.uk",
  password = "password123",
  role: "administrator" | "reviewer" = "administrator"
) {
  const passwordHash = await bcrypt.hash(password, 4); // low cost factor — tests only
  await query(`INSERT INTO admin_users (email, password_hash, role) VALUES ($1, $2, $3)`, [
    email,
    passwordHash,
    role,
  ]);
  return { email, password, role };
}
