import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "../../src/db/client.js";
import { joinOsmGeometry } from "../../src/etl/joinOsmGeometry.js";

// joinOsmGeometry calls fetchOsmBuildings (which checks a local cache before
// ever hitting Overpass) and geocodePostcodes (which calls postcodes.io).
// Seeding the cache directly means fetchOsmBuildings never makes a real
// network call, and mocking fetch covers the postcodes.io call — so this
// test runs fully offline and deterministically, while still exercising
// the real joinOsmGeometry function end to end against a real database.
const CACHE_PATH = path.resolve(process.cwd(), ".cache/osm-buildings-newcastle.json");

describe("joinOsmGeometry — resilience to bad records", () => {
  beforeEach(() => {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify([{ id: 999, lat: 54.97, lon: -1.61, uprn: null }]));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: [] }), // no postcode geocode matches — fine for this test
      })
    );
  });

  afterEach(() => {
    fs.rmSync(CACHE_PATH, { force: true });
    vi.unstubAllGlobals();
  });

  it("REGRESSION: a record with a null uprn is skipped with a warning, and does not abort processing of the other records", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const goodRecord = {
      uprn: 555555,
      address: "1 Real Street",
      postcode: "NE1 1AA",
      propertyType: "Domestic",
      floorAreaSqm: null,
      band: "C",
      inspectionDate: "2024-01-01",
      certificateNumber: "cert-good",
      recommendations: [],
    };

    // Reproduces the exact real-world crash: a domestic EPC record with no
    // UPRN at all, cast to any since the real bug data violates our own
    // (correct) TypeScript type — exactly why it crashed the database
    // instead of being caught by the type system.
    const badRecord = {
      uprn: null as any,
      address: "12 Croydon Road",
      postcode: "NE4 6JS",
      propertyType: "Domestic",
      floorAreaSqm: null,
      band: "C",
      inspectionDate: "2026-08-23",
      certificateNumber: "cert-bad",
      recommendations: [],
    };

    await expect(joinOsmGeometry([goodRecord, badRecord] as any)).resolves.not.toThrow();

    const { rows } = await pool.query(`SELECT uprn FROM hereditaments WHERE uprn = $1`, [
      goodRecord.uprn,
    ]);
    expect(rows).toHaveLength(1); // the good record still made it in

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping record"));

    warnSpy.mockRestore();
  });
});
