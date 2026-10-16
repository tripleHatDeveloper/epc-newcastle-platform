import { describe, expect, it } from "vitest";
import {
  findNearestBuilding,
  haversineMeters,
  isValidUkPostcode,
  type OsmBuilding,
} from "../../src/etl/joinOsmGeometry.js";

describe("haversineMeters", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMeters(54.9738, -1.6144, 54.9738, -1.6144)).toBe(0);
  });

  it("matches a known real-world distance (London to Paris, ~344km)", () => {
    const distance = haversineMeters(51.5074, -0.1278, 48.8566, 2.3522);
    expect(distance).toBeGreaterThan(340_000);
    expect(distance).toBeLessThan(348_000);
  });

  it("gives a small, plausible distance for two nearby Newcastle city-centre points", () => {
    // Two real coordinates captured from live Overpass data during development —
    // Central Exchange and Grainger Market, both in Newcastle city centre.
    const distance = haversineMeters(54.9731991, -1.6132709, 54.9728203, -1.6149412);
    expect(distance).toBeGreaterThan(50);
    expect(distance).toBeLessThan(200);
  });
});

describe("isValidUkPostcode", () => {
  it("accepts standard UK postcode formats", () => {
    expect(isValidUkPostcode("NE1 7RU")).toBe(true);
    expect(isValidUkPostcode("NE4 8RN")).toBe(true);
    expect(isValidUkPostcode("SW1A 1AA")).toBe(true);
  });

  it("accepts postcodes without a space and in lowercase", () => {
    expect(isValidUkPostcode("ne48rn")).toBe(true);
    expect(isValidUkPostcode("SW1A1AA")).toBe(true);
  });

  it("rejects non-postcode strings", () => {
    expect(isValidUkPostcode("hello world")).toBe(false);
    expect(isValidUkPostcode("12345")).toBe(false);
    expect(isValidUkPostcode("")).toBe(false);
  });
});

describe("findNearestBuilding", () => {
  const buildings: OsmBuilding[] = [
    { id: 1, lat: 54.9738, lon: -1.6144, uprn: null }, // ~0m from target
    { id: 2, lat: 54.9740, lon: -1.6140, uprn: null }, // a bit further
    { id: 3, lat: 55.0, lon: -1.5, uprn: null }, // far away
  ];

  it("returns the closest building within the distance threshold", () => {
    const result = findNearestBuilding(54.9738, -1.6144, buildings, 75);
    expect(result?.id).toBe(1);
  });

  it("returns null when nothing is within the distance threshold", () => {
    const result = findNearestBuilding(0, 0, buildings, 75);
    expect(result).toBeNull();
  });

  it("returns null for an empty building list", () => {
    expect(findNearestBuilding(54.9738, -1.6144, [], 75)).toBeNull();
  });

  it("respects a wider distance threshold when given one", () => {
    // Building 2 is further than building 1 but still within a generous threshold.
    const result = findNearestBuilding(54.974, -1.614, buildings, 1000);
    expect(result).not.toBeNull();
  });
});
