import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicViewerPage } from "../../src/public-viewer/PublicViewerPage";
import * as client from "../../src/api/client";

// CesiumMap needs a real WebGL context, which jsdom can't provide — stub it
// with something that just renders its data prop so we can assert on it.
vi.mock("../../src/shared/CesiumMap", () => ({
  CesiumMap: ({ dataByOsmId }: any) => (
    <div data-testid="cesium-map-stub">{JSON.stringify(dataByOsmId)}</div>
  ),
}));

vi.mock("../../src/api/client", () => ({
  getBuildings: vi.fn(),
  getBuilding: vi.fn(),
}));

describe("PublicViewerPage — filter response ordering", () => {
  it("REGRESSION: keeps the most recently requested filter's result, even when an earlier request resolves later", async () => {
    // Reproduces the exact reported bug: switching a filter (e.g. property
    // type) and then switching it back fires two requests close together,
    // with no guarantee they resolve in the order they were sent. Without
    // a guard, whichever response happens to land last wins — even if it
    // was actually requested first — silently showing stale, wrong data.
    let resolveStaleRequest: (value: any) => void;
    let resolveFreshRequest: (value: any) => void;

    const staleRequest = new Promise((resolve) => {
      resolveStaleRequest = resolve;
    });
    const freshRequest = new Promise((resolve) => {
      resolveFreshRequest = resolve;
    });

    let callCount = 0;
    (client.getBuildings as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([]); // initial mount load
      if (callCount === 2) return staleRequest; // first filter change
      return freshRequest; // second filter change, fired right after
    });

    render(<PublicViewerPage />);
    await waitFor(() => expect(client.getBuildings).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "F" })); // -> staleRequest
    fireEvent.click(screen.getByRole("button", { name: "F" })); // untick -> freshRequest

    // Resolve OUT OF ORDER: the second (fresher) request resolves first
    // with the correct result, then the first (now-stale) request resolves
    // afterwards with data that must NOT be allowed to overwrite it.
    resolveFreshRequest!([{ uprn: 2, osm_feature_id: "222", epc_band: "C" }]);
    await waitFor(() => {
      expect(screen.getByTestId("cesium-map-stub").textContent).toContain("222");
    });

    resolveStaleRequest!([{ uprn: 1, osm_feature_id: "111", epc_band: "F" }]);
    await new Promise((resolve) => setTimeout(resolve, 50)); // let any bad update apply

    expect(screen.getByTestId("cesium-map-stub").textContent).toContain("222");
    expect(screen.getByTestId("cesium-map-stub").textContent).not.toContain("111");
  });
});
