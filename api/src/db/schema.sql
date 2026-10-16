CREATE EXTENSION IF NOT EXISTS postgis;

-- One row per hereditament (building/unit) pulled from the EPC register
-- and matched to a Cesium OSM Buildings feature via geometry/address matching.
CREATE TABLE IF NOT EXISTS hereditaments (
  uprn BIGINT PRIMARY KEY,
  address TEXT NOT NULL,
  zone TEXT,                          -- e.g. "City centre", "Ouseburn" — used by the zone filter
  property_type TEXT,
  floor_area_sqm NUMERIC,
  epc_band CHAR(1) CHECK (epc_band IN ('A','B','C','D','E','F','G')),
  epc_inspection_date DATE,
  geom GEOMETRY(Point, 4326),
  osm_feature_id BIGINT,              -- links to the Cesium OSM Buildings tileset feature
  status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (status IN ('unverified','verified','flagged','superseded','reported')),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hereditaments_geom ON hereditaments USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_hereditaments_band ON hereditaments (epc_band);
CREATE INDEX IF NOT EXISTS idx_hereditaments_status ON hereditaments (status);

-- One row per recommended measure for a hereditament, sourced from the
-- EPC recommendations dataset by default, or entered manually by an admin.
CREATE TABLE IF NOT EXISTS recommendations (
  id SERIAL PRIMARY KEY,
  uprn BIGINT NOT NULL REFERENCES hereditaments(uprn) ON DELETE CASCADE,
  measure TEXT NOT NULL,
  payback_category TEXT CHECK (payback_category IN ('short','medium','long')),
  estimated_cost NUMERIC,
  source TEXT NOT NULL DEFAULT 'epc_assessor'
    CHECK (source IN ('epc_assessor','manual_override')),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_uprn ON recommendations (uprn);

-- Internal admin notes left during validation, never shown publicly.
CREATE TABLE IF NOT EXISTS review_notes (
  id SERIAL PRIMARY KEY,
  uprn BIGINT NOT NULL REFERENCES hereditaments(uprn) ON DELETE CASCADE,
  admin_user TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Public "report an issue" submissions. uprn is NULL for general feedback
-- submitted from the footer, and set for building-specific reports —
-- that single field is what routes a submission to the admin queue
-- (as status = 'reported') versus a general feedback inbox.
CREATE TABLE IF NOT EXISTS issue_reports (
  id SERIAL PRIMARY KEY,
  uprn BIGINT REFERENCES hereditaments(uprn) ON DELETE SET NULL,
  message TEXT NOT NULL,
  reporter_email TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  resolved BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_issue_reports_uprn ON issue_reports (uprn);

-- Admin/staff accounts. Role determines access, never chosen by the user at login.
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reviewer' CHECK (role IN ('reviewer','administrator')),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
