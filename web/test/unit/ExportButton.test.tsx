import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicViewerPage } from "../../src/public-viewer/PublicViewerPage";
import * as client from "../../src/api/client";
import * as exportModule from "../../src/public-viewer/exportToExcel";

vi.mock("../../src/shared/CesiumMap", () => ({
  CesiumMap: () => <div data-testid="cesium-map-stub" />,
}));

vi.mock("../../src/api/client", () => ({
  getBuildings: vi.fn(),
  getBuilding: vi.fn(),
}));

vi.mock("../../src/public-viewer/exportToExcel", () => ({
  exportBuildingsToExcel: vi.fn(),
}));

describe("PublicViewerPage — export to Excel button", () => {
  it("is disabled with a zero count when no buildings are loaded", async () => {
    (client.getBuildings as any).mockResolvedValue([]);
    render(<PublicViewerPage />);

    await waitFor(() => expect(client.getBuildings).toHaveBeenCalled());

    const button = screen.getByText("Export 0 buildings to Excel");
    expect(button).toBeDisabled();
  });

  it("enables and shows the correct count once buildings are loaded, and exports exactly that list on click", async () => {
    const loadedBuildings = [
      { uprn: 1, address: "14 Grainger Street", epc_band: "F", osm_feature_id: "101" },
      { uprn: 2, address: "22 Clayton Street", epc_band: "C", osm_feature_id: "102" },
    ];
    (client.getBuildings as any).mockResolvedValue(loadedBuildings);

    render(<PublicViewerPage />);
    await waitFor(() => expect(client.getBuildings).toHaveBeenCalled());

    const button = await screen.findByText("Export 2 buildings to Excel");
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    expect(exportModule.exportBuildingsToExcel).toHaveBeenCalledWith(loadedBuildings);
  });

  it("uses singular wording for exactly one building", async () => {
    (client.getBuildings as any).mockResolvedValue([
      { uprn: 1, address: "14 Grainger Street", epc_band: "F", osm_feature_id: "101" },
    ]);

    render(<PublicViewerPage />);
    await waitFor(() => expect(client.getBuildings).toHaveBeenCalled());

    expect(await screen.findByText("Export 1 building to Excel")).toBeInTheDocument();
  });
});
