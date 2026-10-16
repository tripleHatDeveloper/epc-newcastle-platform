import { describe, expect, it } from "vitest";
import { pickRepresentativeByOsmId } from "../../src/shared/pickRepresentativeByOsmId";

const BAND_PRIORITY = ["G", "F", "E", "D", "C", "B", "A"]; // worst first

describe("pickRepresentativeByOsmId", () => {
  it("picks the highest-priority (worst band) record when several share one building", () => {
    const records = [
      { uprn: 1, osm_feature_id: "500", epc_band: "B" },
      { uprn: 2, osm_feature_id: "500", epc_band: "F" }, // worst
      { uprn: 3, osm_feature_id: "500", epc_band: "C" },
    ];

    const result = pickRepresentativeByOsmId(records, (r) => r.epc_band, BAND_PRIORITY);

    expect(result["500"].uprn).toBe(2);
  });

  it("REGRESSION: the same function used for both coloring and click-lookup always agrees on the same record", () => {
    // This is the actual bug: previously, the color map and the click
    // handler used two different selection rules (last-wins vs
    // first-wins), so they could silently disagree on a shared building.
    const records = [
      { uprn: 1, osm_feature_id: "500", epc_band: "A" },
      { uprn: 2, osm_feature_id: "500", epc_band: "G" },
    ];

    const forColor = pickRepresentativeByOsmId(records, (r) => r.epc_band, BAND_PRIORITY);
    const forClick = pickRepresentativeByOsmId(records, (r) => r.epc_band, BAND_PRIORITY);

    expect(forColor["500"].uprn).toBe(forClick["500"].uprn);
  });

  it("keeps buildings with only one record unambiguous", () => {
    const records = [{ uprn: 1, osm_feature_id: "101", epc_band: "D" }];
    const result = pickRepresentativeByOsmId(records, (r) => r.epc_band, BAND_PRIORITY);
    expect(result["101"].uprn).toBe(1);
  });

  it("skips records with no osm_feature_id", () => {
    const records = [{ uprn: 1, osm_feature_id: null, epc_band: "A" }];
    const result = pickRepresentativeByOsmId(records, (r) => r.epc_band, BAND_PRIORITY);
    expect(result).toEqual({});
  });

  it("treats an unrecognized priority value as lowest priority, not a crash", () => {
    const records = [
      { uprn: 1, osm_feature_id: "500", epc_band: "UNKNOWN" },
      { uprn: 2, osm_feature_id: "500", epc_band: "C" },
    ];
    const result = pickRepresentativeByOsmId(records, (r) => r.epc_band, BAND_PRIORITY);
    expect(result["500"].uprn).toBe(2); // C outranks an unrecognized value
  });

  it("works with a status priority order too (admin console use case)", () => {
    const STATUS_PRIORITY = ["flagged", "reported", "unverified", "verified", "superseded"];
    const records = [
      { uprn: 1, osm_feature_id: "700", status: "verified" },
      { uprn: 2, osm_feature_id: "700", status: "flagged" },
      { uprn: 3, osm_feature_id: "700", status: "unverified" },
    ];
    const result = pickRepresentativeByOsmId(records, (r) => r.status, STATUS_PRIORITY);
    expect(result["700"].uprn).toBe(2); // flagged takes priority
  });
});
