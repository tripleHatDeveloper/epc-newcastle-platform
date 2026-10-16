import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicViewerPage } from "../../src/public-viewer/PublicViewerPage";
import * as client from "../../src/api/client";

vi.mock("../../src/shared/CesiumMap", () => ({
  CesiumMap: ({ onSelectBuilding }: any) => (
    <div data-testid="cesium-map-stub">
      <button onClick={() => onSelectBuilding("101")}>simulate-pick-building</button>
    </div>
  ),
}));

vi.mock("../../src/api/client", () => ({
  getBuildings: vi.fn(),
  getBuilding: vi.fn(),
}));

describe("PublicViewerPage — click outside closes the detail panel", () => {
  function setup() {
    (client.getBuildings as any).mockResolvedValue([
      { uprn: 1, osm_feature_id: "101", epc_band: "F" },
    ]);
    (client.getBuilding as any).mockResolvedValue({
      uprn: 1,
      address: "14 Grainger Street",
      property_type: "Offices",
      floor_area_sqm: 1240,
      epc_band: "F",
      recommendations: [],
    });
  }

  async function selectABuilding() {
    render(<PublicViewerPage />);
    await waitFor(() => expect(client.getBuildings).toHaveBeenCalled());
    fireEvent.click(screen.getByText("simulate-pick-building"));
    await waitFor(() => expect(screen.getByText("14 Grainger Street")).toBeInTheDocument());
  }

  it("closes the detail panel when clicking outside it", async () => {
    setup();
    await selectABuilding();

    fireEvent.mouseDown(screen.getByText("Filters")); // clicking elsewhere on the page

    await waitFor(() => {
      expect(screen.queryByText("14 Grainger Street")).not.toBeInTheDocument();
    });
  });

  it("does NOT close the panel when clicking inside it", async () => {
    setup();
    await selectABuilding();

    fireEvent.mouseDown(screen.getByText("14 Grainger Street")); // clicking inside the panel itself

    expect(screen.getByText("14 Grainger Street")).toBeInTheDocument();
  });

  it("does NOT close the panel from a click on the map itself — that's handled by the map's own picking, not this listener", async () => {
    setup();
    await selectABuilding();

    fireEvent.mouseDown(screen.getByTestId("cesium-map-stub"));

    expect(screen.getByText("14 Grainger Street")).toBeInTheDocument();
  });
});
