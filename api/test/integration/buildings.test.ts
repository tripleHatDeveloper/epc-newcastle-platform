import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { seedBuilding, seedRecommendation } from "../helpers.js";

const app = createApp();

describe("GET /api/buildings", () => {
  it("returns an empty list when nothing is seeded", async () => {
    const res = await request(app).get("/api/buildings");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns seeded buildings and never exposes the status field", async () => {
    await seedBuilding({ status: "flagged" });

    const res = await request(app).get("/api/buildings");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].address).toBe("14 Grainger Street");
    expect(res.body[0]).not.toHaveProperty("status");
  });

  it("filters by EPC band", async () => {
    await seedBuilding({ uprn: 1, address: "Building A", epc_band: "F" });
    await seedBuilding({ uprn: 2, address: "Building B", epc_band: "C" });

    const res = await request(app).get("/api/buildings").query({ band: "F" });

    expect(res.body).toHaveLength(1);
    expect(res.body[0].address).toBe("Building A");
  });

  it("filters by a mixed subset of multiple EPC bands at once", async () => {
    await seedBuilding({ uprn: 1, address: "Band A building", epc_band: "A" });
    await seedBuilding({ uprn: 2, address: "Band D building", epc_band: "D" });
    await seedBuilding({ uprn: 3, address: "Band E building", epc_band: "E" });
    await seedBuilding({ uprn: 4, address: "Band F building", epc_band: "F" });

    const res = await request(app).get("/api/buildings").query({ band: "A,D,E" });

    const addresses = res.body.map((b: any) => b.address).sort();
    expect(addresses).toEqual(["Band A building", "Band D building", "Band E building"]);
  });

  it("filters by EPC issue date (issuedAfter), for the 'last N days/months/years' picker", async () => {
    await seedBuilding({
      uprn: 1,
      address: "Recently issued",
      epc_inspection_date: "2026-08-01",
    });
    await seedBuilding({
      uprn: 2,
      address: "Issued long ago",
      epc_inspection_date: "2018-01-01",
    });

    const res = await request(app).get("/api/buildings").query({ issuedAfter: "2025-01-01" });

    expect(res.body).toHaveLength(1);
    expect(res.body[0].address).toBe("Recently issued");
  });

  it("filters by minimum floor area", async () => {
    await seedBuilding({ uprn: 1, address: "Small", floor_area_sqm: 500 });
    await seedBuilding({ uprn: 2, address: "Large", floor_area_sqm: 2000 });

    const res = await request(app).get("/api/buildings").query({ minFloorArea: 1000 });

    expect(res.body).toHaveLength(1);
    expect(res.body[0].address).toBe("Large");
  });

  it("REGRESSION: a minFloorArea of 0 means no constraint at all, including buildings with no floor area recorded", async () => {
    // The test above never exercises a null floor area at all — the seed
    // helper defaults to a real value unless explicitly overridden — which
    // is exactly why this bug went unnoticed: "0" arrives as a string from
    // query params (truthy in JS), so floor_area_sqm >= 0 was still being
    // applied, and NULL >= 0 evaluates to NULL (not true) in SQL, silently
    // excluding every domestic building (which never has a floor area)
    // even at the slider's minimum value.
    await seedBuilding({ uprn: 1, address: "Domestic, no floor area", floor_area_sqm: null });
    await seedBuilding({ uprn: 2, address: "Non-domestic with floor area", floor_area_sqm: 1240 });

    const res = await request(app).get("/api/buildings").query({ minFloorArea: 0 });

    expect(res.body).toHaveLength(2);
  });

  it("combines multiple filters (zone + property type)", async () => {
    await seedBuilding({ uprn: 1, address: "Match", zone: "City centre", property_type: "Offices" });
    await seedBuilding({ uprn: 2, address: "Wrong zone", zone: "Ouseburn", property_type: "Offices" });
    await seedBuilding({ uprn: 3, address: "Wrong type", zone: "City centre", property_type: "Retail" });

    const res = await request(app)
      .get("/api/buildings")
      .query({ zone: "City centre", propertyType: "Offices" });

    expect(res.body).toHaveLength(1);
    expect(res.body[0].address).toBe("Match");
  });

  it("REGRESSION: matches real-world property_type strings by substring, not exact equality", async () => {
    // Real EPC data returns long, specific strings (confirmed against the
    // live API), never a simple label like "Offices" on its own — an exact
    // equality filter would silently match nothing at all. This uses the
    // actual real-world string confirmed earlier.
    await seedBuilding({
      uprn: 1,
      address: "435 Westgate Road",
      property_type: "B1 Offices and Workshop businesses",
    });
    await seedBuilding({
      uprn: 2,
      address: "Some Restaurant",
      property_type: "Restaurants and Cafes/Drinking Establishments/Takeaways",
    });

    const res = await request(app).get("/api/buildings").query({ propertyType: "Offices" });

    expect(res.body).toHaveLength(1);
    expect(res.body[0].address).toBe("435 Westgate Road");
  });

  it("property type filtering is case-insensitive", async () => {
    await seedBuilding({ uprn: 1, address: "Match", property_type: "B1 Offices and Workshop businesses" });

    const res = await request(app).get("/api/buildings").query({ propertyType: "office" });

    expect(res.body).toHaveLength(1);
  });
});

describe("GET /api/buildings/:uprn", () => {
  it("returns 404 for an unknown building", async () => {
    const res = await request(app).get("/api/buildings/999999999999");
    expect(res.status).toBe(404);
  });

  it("returns building detail with its recommendations, including recommendation id", async () => {
    const building = await seedBuilding();
    await seedRecommendation(building.uprn);

    const res = await request(app).get(`/api/buildings/${building.uprn}`);

    expect(res.status).toBe(200);
    expect(res.body.address).toBe("14 Grainger Street");
    expect(res.body.recommendations).toHaveLength(1);
    // Regression test for the bug where recommendation id was never
    // selected, silently breaking the admin edit modal.
    expect(res.body.recommendations[0]).toHaveProperty("id");
    expect(res.body.recommendations[0].measure).toBe("LED lighting");
  });

  it("never exposes the status field on the detail route either", async () => {
    const building = await seedBuilding({ status: "flagged" });
    const res = await request(app).get(`/api/buildings/${building.uprn}`);
    expect(res.body).not.toHaveProperty("status");
  });
});
