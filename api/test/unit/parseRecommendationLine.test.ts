import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseRecommendationLine } from "../../src/etl/fetchEpcRegister.js";

// This fixture is a single, real, unmodified line captured from the live
// non-domestic recommendations bulk file (September 2026). It exists because
// the first implementation of this parser was based on guessed field names
// that turned out to be wrong in several ways — this locks in the real shape.
const REAL_LINE = fs.readFileSync(
  path.resolve(__dirname, "../fixtures/real-recommendation-line.txt"),
  "utf-8"
);

describe("parseRecommendationLine", () => {
  it("parses a real captured line without error", () => {
    const result = parseRecommendationLine(REAL_LINE);
    expect(result).not.toBeNull();
  });

  it("extracts the original certificate number from the nested document, not the outer wrapper", () => {
    const result = parseRecommendationLine(REAL_LINE)!;
    // The outer certificate_number in this fixture is the recommendations
    // report's own number, not the original EPC certificate — the join key
    // is `related_certificate_number` inside the parsed `document` string.
    expect(result.originalCertificateNumber).toBe("9676-6331-8955-7742-4212");
  });

  it("flattens short/medium/long payback arrays into one list, tagged by category", () => {
    const result = parseRecommendationLine(REAL_LINE)!;
    const categories = new Set(result.recommendations.map((r) => r.paybackCategory));
    expect(categories).toEqual(new Set(["short", "long"])); // this fixture has no medium items
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("uses the human-readable recommendation text as the measure, not the internal code", () => {
    const result = parseRecommendationLine(REAL_LINE)!;
    const longItem = result.recommendations.find((r) => r.paybackCategory === "long");
    const shortItem = result.recommendations.find((r) => r.paybackCategory === "short");

    expect(longItem?.measure).toBe("Add optimum start/stop to the heating system.");
    expect(shortItem?.measure).toMatch(/^In some spaces, the solar gain limit/);
    // Neither should be the internal code (e.g. "EPC-H7") — that's a separate field.
    expect(longItem?.measure).not.toMatch(/^EPC-/);
  });

  it("returns null for a malformed line rather than throwing", () => {
    expect(parseRecommendationLine("not valid json{{{")).toBeNull();
  });

  it("returns null for a blank line", () => {
    expect(parseRecommendationLine("   ")).toBeNull();
  });
});
