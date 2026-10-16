import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EpcBuddyChat } from "../../src/public-viewer/EpcBuddyChat";
import * as client from "../../src/api/client";

vi.mock("../../src/api/client", () => ({
  askEpcBuddy: vi.fn(),
}));

describe("EpcBuddyChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the building's address in the title", () => {
    render(<EpcBuddyChat uprn={1} address="14 Grainger Street" />);
    expect(screen.getByText("EPC buddy · 14 Grainger Street")).toBeInTheDocument();
  });

  it("sends the question to askEpcBuddy scoped to the right uprn, and displays both messages", async () => {
    (client.askEpcBuddy as any).mockResolvedValue({ answer: "Band F means high running costs." });

    render(<EpcBuddyChat uprn={789} address="14 Grainger Street" />);

    const input = screen.getByPlaceholderText("Ask about this building's rating");
    fireEvent.change(input, { target: { value: "Why is this rated F?" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("Why is this rated F?")).toBeInTheDocument();
    await waitFor(() => {
      expect(client.askEpcBuddy).toHaveBeenCalledWith(789, "Why is this rated F?");
    });
    expect(await screen.findByText("Band F means high running costs.")).toBeInTheDocument();
  });

  it("clears the input after sending", async () => {
    (client.askEpcBuddy as any).mockResolvedValue({ answer: "..." });
    render(<EpcBuddyChat uprn={1} address="Test" />);

    const input = screen.getByPlaceholderText(
      "Ask about this building's rating"
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "test question" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(input.value).toBe(""));
  });

  it("does not send an empty question", () => {
    render(<EpcBuddyChat uprn={1} address="Test" />);
    const input = screen.getByPlaceholderText("Ask about this building's rating");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(client.askEpcBuddy).not.toHaveBeenCalled();
  });
});
