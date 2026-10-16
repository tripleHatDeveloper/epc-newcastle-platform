import { afterEach, describe, expect, it } from "vitest";
import { isoDate, tenYearWindow } from "../../src/etl/fetchEpcRegister.js";

describe("isoDate", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(isoDate(new Date("2026-09-11T10:00:00Z"))).toBe("2026-09-11");
  });
});

describe("tenYearWindow", () => {
  afterEach(() => {
    delete process.env.ETL_LOOKBACK_DAYS;
  });

  it("ends the day before the reference date, never on the reference date itself", () => {
    const { dateEnd } = tenYearWindow(new Date("2026-09-11T00:00:00Z"));
    expect(dateEnd).toBe("2026-09-10");
  });

  it("starts exactly ten years before the end date, by default", () => {
    const { dateStart, dateEnd } = tenYearWindow(new Date("2026-09-11T00:00:00Z"));
    expect(dateStart).toBe("2016-09-10");
    expect(dateEnd).toBe("2026-09-10");
  });

  it("never includes today's date, satisfying the API's rejection rule", () => {
    const today = new Date();
    const { dateEnd } = tenYearWindow(today);
    expect(dateEnd).not.toBe(isoDate(today));
  });

  it("respects ETL_LOOKBACK_DAYS for a shorter test window, without changing the default", () => {
    process.env.ETL_LOOKBACK_DAYS = "30";
    const { dateStart, dateEnd } = tenYearWindow(new Date("2026-09-11T00:00:00Z"));
    expect(dateEnd).toBe("2026-09-10");
    expect(dateStart).toBe("2026-08-11"); // 30 days before dateEnd
  });
});
