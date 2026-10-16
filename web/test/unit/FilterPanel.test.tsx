import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { computeIssuedAfter, FilterPanel } from "../../src/public-viewer/FilterPanel";

describe("computeIssuedAfter", () => {
  const reference = new Date("2026-09-11T00:00:00Z");

  it("returns undefined for zero or empty values, meaning no constraint", () => {
    expect(computeIssuedAfter(0, "days", reference)).toBeUndefined();
    expect(computeIssuedAfter(-1, "years", reference)).toBeUndefined();
  });

  it("subtracts days correctly", () => {
    expect(computeIssuedAfter(14, "days", reference)).toBe("2026-08-28");
  });

  it("subtracts months correctly", () => {
    expect(computeIssuedAfter(6, "months", reference)).toBe("2026-03-11");
  });

  it("subtracts years correctly", () => {
    expect(computeIssuedAfter(10, "years", reference)).toBe("2016-09-11");
  });
});

describe("FilterPanel", () => {
  it("calls onChange with the selected band when a single band checkbox is ticked", () => {
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "F" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ band: "F" }));
  });

  it("supports ticking a mixed subset of bands, sent as a comma-separated value", () => {
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "A" }));
    fireEvent.click(screen.getByRole("button", { name: "D" }));
    fireEvent.click(screen.getByRole("button", { name: "E" }));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ band: "A,D,E" }));
  });

  it("unticking a band removes it from the selection without affecting the others", () => {
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "A" }));
    fireEvent.click(screen.getByRole("button", { name: "D" }));
    fireEvent.click(screen.getByRole("button", { name: "A" })); // untick A

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ band: "D" }));
  });

  it("unticking every band clears the filter entirely, same as the old 'All bands' option", () => {
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "F" }));
    fireEvent.click(screen.getByRole("button", { name: "F" })); // untick the only one selected

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ band: undefined }));
  });

  it("floor area inputs are disabled until the 'Filter by floor area' checkbox is ticked", () => {
    render(<FilterPanel onChange={vi.fn()} />);

    const slider = screen.getByRole("slider");
    const number = screen.getAllByRole("spinbutton")[0];
    expect(slider).toBeDisabled();
    expect(number).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Filter by floor area" }));

    expect(slider).not.toBeDisabled();
    expect(number).not.toBeDisabled();
  });

  it("REGRESSION: moving the slider has no effect at all while the checkbox is unticked", () => {
    // Previously, touching the slider applied the filter immediately with
    // no way back except reloading the page — hiding over 99% of buildings
    // (only a small minority have floor area recorded at all) the moment
    // anyone touched it, even by accident.
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    fireEvent.change(screen.getByRole("slider"), { target: { value: "2500" } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("ticking the checkbox applies the current floor area value immediately", () => {
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Filter by floor area" }));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ minFloorArea: 1000 }));
  });

  it("REGRESSION: moving the slider to 0 while enabled sends no constraint at all, not floor_area_sqm >= 0", () => {
    // Confirmed as a real bug against the actual database: query params
    // arrive as strings, so "0" is truthy in JS, and NULL >= 0 evaluates
    // to NULL (not true) in SQL — meaning every building with no recorded
    // floor area (the vast majority) was silently excluded even at the
    // slider's minimum value, which is the opposite of what 0 should mean.
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Filter by floor area" }));
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "0" } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ minFloorArea: undefined }));
  });

  it("REGRESSION: unticking the checkbox clears the floor area filter entirely, without needing a page reload", () => {
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "Filter by floor area" });
    fireEvent.click(checkbox); // on
    fireEvent.click(checkbox); // off again

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ minFloorArea: undefined }));
  });

  it("keeps the slider and number input in sync with each other, once enabled", () => {
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Filter by floor area" }));

    const slider = screen.getByRole("slider");
    const number = screen.getAllByRole("spinbutton")[0]; // floor area is the first number input

    expect(number).toHaveValue(1000); // default

    fireEvent.change(slider, { target: { value: "2500" } });
    expect(number).toHaveValue(2500);

    fireEvent.change(number, { target: { value: "3000" } });
    expect(slider).toHaveValue("3000");
  });

  it("reports the floor area change through onChange, once enabled", () => {
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Filter by floor area" }));
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "2000" } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ minFloorArea: 2000 }));
  });

  it("REGRESSION: ticking a band alone does not silently include a floor area constraint the user never touched", () => {
    // The test above uses objectContaining, which only checks the keys it
    // names and ignores anything else — that's exactly why this bug slipped
    // through undetected: filters state used to start as
    // { minFloorArea: 1000 }, so every other control's onChange silently
    // merged that in too, even though the user never touched floor area.
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "F" }));

    const callArgs = onChange.mock.calls[0][0];
    expect(callArgs).toEqual({ band: "F" }); // exact shape, not objectContaining
    expect(callArgs.minFloorArea).toBeUndefined();
  });

  it("clicking 'All' clears any selected bands and shows as the active chip again", () => {
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "A" }));
    fireEvent.click(screen.getByRole("button", { name: "D" }));
    fireEvent.click(screen.getByRole("button", { name: "All" }));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ band: undefined }));
    expect(screen.getByRole("button", { name: "All" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "A" })).not.toHaveClass("active");
  });

  it("'All' shows as active by default, before anything is selected", () => {
    render(<FilterPanel onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "All" })).toHaveClass("active");
  });

  it("computes and sends issuedAfter once a value is entered, defaulting to years", () => {
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("Any time"), { target: { value: "10" } });

    const callArgs = onChange.mock.calls[0][0];
    expect(callArgs.issuedAfter).toBeDefined();
    expect(callArgs.issuedAfter).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("recomputes issuedAfter when the unit is changed after a value is already set", () => {
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("Any time"), { target: { value: "6" } });
    const withYears = onChange.mock.calls.at(-1)![0].issuedAfter;

    fireEvent.change(screen.getByDisplayValue("Years"), { target: { value: "months" } });
    const withMonths = onChange.mock.calls.at(-1)![0].issuedAfter;

    expect(withYears).not.toBe(withMonths); // 6 years ago vs 6 months ago differ
  });

  it("clearing the issued-within value removes the constraint entirely", () => {
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    const input = screen.getByPlaceholderText("Any time");
    fireEvent.change(input, { target: { value: "6" } });
    fireEvent.change(input, { target: { value: "" } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ issuedAfter: undefined }));
  });

  it("REGRESSION: typing 0 for the issued-within value behaves the same as leaving it blank, not as a distinct ambiguous state", () => {
    const onChange = vi.fn();
    render(<FilterPanel onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("Any time"), { target: { value: "0" } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ issuedAfter: undefined }));
  });
});
