import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "../../src/admin/AdminPage";
import * as client from "../../src/api/client";

vi.mock("../../src/shared/CesiumMap", () => ({
  CesiumMap: () => <div data-testid="cesium-map-stub" />,
}));

vi.mock("../../src/api/client", () => ({
  getAdminBuildings: vi.fn().mockResolvedValue([]),
  getBuilding: vi.fn(),
  getQueueCounts: vi.fn().mockResolvedValue({ all: 0 }),
}));

function renderAdminPage() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/" element={<div>Public viewer page</div>} />
        <Route path="/admin/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminPage — header navigation", () => {
  beforeEach(() => {
    localStorage.setItem("epc_token", "fake-token");
  });

  it("links back to the public viewer", async () => {
    renderAdminPage();
    await waitFor(() => expect(client.getAdminBuildings).toHaveBeenCalled());

    const link = screen.getByText("View public site");
    expect(link.closest("a")).toHaveAttribute("href", "/");
  });

  it("REGRESSION: signing out clears the stored token and navigates to the login page", async () => {
    renderAdminPage();
    await waitFor(() => expect(client.getAdminBuildings).toHaveBeenCalled());

    expect(localStorage.getItem("epc_token")).toBe("fake-token");

    fireEvent.click(screen.getByText("Sign out"));

    await waitFor(() => expect(screen.getByText("Login page")).toBeInTheDocument());
    expect(localStorage.getItem("epc_token")).toBeNull();
  });
});
