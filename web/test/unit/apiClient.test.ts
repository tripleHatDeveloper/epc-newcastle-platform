import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "../../src/api/client";

describe("api/client", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true }),
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getBuildings only includes filters that are actually set", async () => {
    await client.getBuildings({ band: "F", zone: undefined, minFloorArea: 1000 });

    const calledUrl = (global.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain("band=F");
    expect(calledUrl).toContain("minFloorArea=1000");
    expect(calledUrl).not.toContain("zone=");
  });

  it("submitReport sends uprn as null for general feedback", async () => {
    await client.submitReport(null, "general feedback message");

    const [, options] = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.uprn).toBeNull();
    expect(body.message).toBe("general feedback message");
  });

  it("submitReport sends the real uprn for a building-specific report", async () => {
    await client.submitReport(123, "wrong band shown");

    const [, options] = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.uprn).toBe(123);
  });

  it("admin requests include no Authorization header when signed out", async () => {
    await client.getAdminBuildings();

    const [, options] = (global.fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it("admin requests include the Bearer token once signed in", async () => {
    localStorage.setItem("epc_token", "abc123");

    await client.getAdminBuildings();

    const [, options] = (global.fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer abc123");
  });

  it("updateRecommendation PUTs to the correct id-scoped URL with auth", async () => {
    localStorage.setItem("epc_token", "tok");

    await client.updateRecommendation(42, {
      measure: "Insulation",
      payback_category: "long",
      estimated_cost: 1000,
      source: "manual_override",
    });

    const [url, options] = (global.fetch as any).mock.calls[0];
    expect(url).toContain("/admin/recommendations/42");
    expect(options.method).toBe("PUT");
    expect(options.headers.Authorization).toBe("Bearer tok");
  });
});
