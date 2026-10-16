import { describe, expect, it } from "vitest";
import { buildingsToExportRows } from "../../src/public-viewer/exportToExcel";

describe("buildingsToExportRows", () => {
  it("maps building fields to readable export column names", () => {
    const rows = buildingsToExportRows([
      {
        uprn: 1,
        address: "14 Grainger Street",
        zone: "City centre",
        property_type: "Offices",
        floor_area_sqm: 1240,
        epc_band: "F",
        lat: 54.97,
        lng: -1.61,
      },
    ]);

    expect(rows).toEqual([
      {
        UPRN: 1,
        Address: "14 Grainger Street",
        Zone: "City centre",
        "Property type": "Offices",
        "Floor area (sqm)": 1240,
        "EPC band": "F",
        Latitude: 54.97,
        Longitude: -1.61,
      },
    ]);
  });

  it("handles a missing floor area (domestic buildings) and missing zone gracefully", () => {
    const rows = buildingsToExportRows([
      {
        uprn: 2,
        address: "Some House",
        property_type: "Domestic",
        floor_area_sqm: null,
        epc_band: "C",
      },
    ]);

    expect(rows[0]["Floor area (sqm)"]).toBe("");
    expect(rows[0].Zone).toBe("");
  });

  it("returns an empty array for no buildings, rather than throwing", () => {
    expect(buildingsToExportRows([])).toEqual([]);
  });

  it("preserves the order of the input buildings", () => {
    const rows = buildingsToExportRows([
      { uprn: 1, address: "First", property_type: "Offices", floor_area_sqm: 100, epc_band: "A" },
      { uprn: 2, address: "Second", property_type: "Retail", floor_area_sqm: 200, epc_band: "B" },
    ]);
    expect(rows.map((r) => r.Address)).toEqual(["First", "Second"]);
  });
});
