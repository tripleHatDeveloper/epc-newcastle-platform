import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BuildingDetail } from "../../src/public-viewer/BuildingDetail";

vi.mock("../../src/public-viewer/EpcBuddyChat", () => ({
  EpcBuddyChat: () => <div data-testid="epc-buddy-stub">EPC buddy panel</div>,
}));
vi.mock("../../src/public-viewer/ReportIssueForm", () => ({
  ReportIssueForm: () => <div data-testid="report-form-stub">Report form</div>,
}));

const baseBuilding = {
  uprn: 1,
  address: "14 Grainger Street",
  property_type: "Offices",
  epc_band: "F",
  recommendations: [],
};

describe("BuildingDetail", () => {
  it("shows the floor area value when present", () => {
    render(<BuildingDetail building={{ ...baseBuilding, floor_area_sqm: 1240 }} />);
    expect(screen.getByText("1240 sqm")).toBeInTheDocument();
  });

  it("REGRESSION: shows 'Not available' for a null floor area, instead of a blank value next to the unit", () => {
    // Domestic EPC records have no floor area by design — this used to
    // render as just " sqm" with nothing before it, which looked broken.
    render(<BuildingDetail building={{ ...baseBuilding, floor_area_sqm: null }} />);
    expect(screen.getByText("Not available")).toBeInTheDocument();
    expect(screen.queryByText(/^\s*sqm/)).not.toBeInTheDocument();
  });

  it("REGRESSION: shows 'None reported' when there are no recommendations, instead of a blank cell", () => {
    render(<BuildingDetail building={{ ...baseBuilding, floor_area_sqm: 500, recommendations: [] }} />);
    expect(screen.getByText("None reported")).toBeInTheDocument();
  });

  it("shows recommended works text when present", () => {
    render(
      <BuildingDetail
        building={{
          ...baseBuilding,
          floor_area_sqm: 500,
          recommendations: [{ measure: "LED lighting", payback_category: "medium" }],
        }}
      />
    );
    expect(screen.getByText("LED lighting")).toBeInTheDocument();
  });

  it("REGRESSION: only one of EPC buddy / report form is open at a time", () => {
    render(<BuildingDetail building={{ ...baseBuilding, floor_area_sqm: 500 }} />);

    fireEvent.click(screen.getByText("Ask EPC buddy"));
    expect(screen.getByTestId("epc-buddy-stub")).toBeInTheDocument();
    expect(screen.queryByTestId("report-form-stub")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Report an issue with this data"));
    expect(screen.queryByTestId("epc-buddy-stub")).not.toBeInTheDocument();
    expect(screen.getByTestId("report-form-stub")).toBeInTheDocument();
  });

  it("clicking the open panel's own button again closes it", () => {
    render(<BuildingDetail building={{ ...baseBuilding, floor_area_sqm: 500 }} />);

    fireEvent.click(screen.getByText("Ask EPC buddy"));
    expect(screen.getByTestId("epc-buddy-stub")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Ask EPC buddy"));
    expect(screen.queryByTestId("epc-buddy-stub")).not.toBeInTheDocument();
  });
});
