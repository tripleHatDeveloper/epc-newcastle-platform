import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ColorLegend } from "../../src/shared/ColorLegend";

describe("ColorLegend", () => {
  it("renders a label and a colored swatch for each item", () => {
    render(
      <ColorLegend
        items={[
          { label: "A", color: "#173404" },
          { label: "G", color: "#A32D2D" },
        ]}
      />
    );

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("G")).toBeInTheDocument();
  });

  it("applies each item's color to its own swatch", () => {
    const { container } = render(
      <ColorLegend items={[{ label: "Flagged", color: "#A3312D" }]} />
    );
    const swatch = container.querySelector(".legend-swatch") as HTMLElement;
    expect(swatch.style.backgroundColor).toBe("rgb(163, 49, 45)"); // #A3312D
  });
});
