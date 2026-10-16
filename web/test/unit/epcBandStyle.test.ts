import { describe, expect, it } from "vitest";
import { EPC_BAND_COLORS } from "../../src/shared/styling/epcBandStyle";

describe("EPC_BAND_COLORS", () => {
  it("defines a color for every band A through G", () => {
    for (const band of ["A", "B", "C", "D", "E", "F", "G"]) {
      expect(EPC_BAND_COLORS[band]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
