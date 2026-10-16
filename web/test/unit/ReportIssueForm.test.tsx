import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportIssueForm } from "../../src/public-viewer/ReportIssueForm";
import * as client from "../../src/api/client";

vi.mock("../../src/api/client", () => ({
  submitReport: vi.fn().mockResolvedValue({ received: true }),
}));

describe("ReportIssueForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the general-feedback framing when no uprn is given", () => {
    render(<ReportIssueForm />);
    expect(screen.getByText("General feedback")).toBeInTheDocument();
    expect(screen.getByText("What would you like to tell us?")).toBeInTheDocument();
  });

  it("shows the building-specific framing when a uprn and label are given", () => {
    render(<ReportIssueForm uprn={123} label="14 Grainger Street" />);
    expect(screen.getByText("14 Grainger Street")).toBeInTheDocument();
    expect(screen.getByText("What's wrong with this building's data?")).toBeInTheDocument();
  });

  it("blocks submission with an empty message and shows an error", () => {
    render(<ReportIssueForm />);
    fireEvent.click(screen.getByText("Submit"));

    expect(screen.getByText("Enter a message before submitting.")).toBeInTheDocument();
    expect(client.submitReport).not.toHaveBeenCalled();
  });

  it("submits with uprn null for general feedback and shows the confirmation", async () => {
    render(<ReportIssueForm />);

    fireEvent.change(screen.getByPlaceholderText("Describe the issue or suggestion"), {
      target: { value: "The map is slow to load." },
    });
    fireEvent.click(screen.getByText("Submit"));

    await waitFor(() => {
      expect(client.submitReport).toHaveBeenCalledWith(null, "The map is slow to load.", undefined);
    });
    expect(await screen.findByText("Thanks — your report has been sent.")).toBeInTheDocument();
  });

  it("submits with the real uprn for a building-specific report", async () => {
    render(<ReportIssueForm uprn={456} label="22 Clayton Street" />);

    fireEvent.change(screen.getByPlaceholderText("e.g. wrong band, building demolished"), {
      target: { value: "Wrong band shown" },
    });
    fireEvent.click(screen.getByText("Submit"));

    await waitFor(() => {
      expect(client.submitReport).toHaveBeenCalledWith(456, "Wrong band shown", undefined);
    });
  });
});
