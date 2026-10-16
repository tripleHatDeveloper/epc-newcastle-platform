import { describe, expect, it } from "vitest";
import { STATUS_COLORS } from "../../src/shared/styling/statusStyle";

describe("STATUS_COLORS", () => {
  it("defines a color for every status used in the admin console", () => {
    for (const status of ["unverified", "verified", "flagged", "reported", "superseded"]) {
      expect(STATUS_COLORS[status]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
