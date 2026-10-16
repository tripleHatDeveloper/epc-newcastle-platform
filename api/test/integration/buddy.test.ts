import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedBuilding, seedRecommendation } from "../helpers.js";

// Mock the Anthropic SDK before importing the app, so the real network
// call is never made. We capture what's actually sent so we can assert
// on it directly.
const createMock = vi.fn().mockResolvedValue({
  content: [{ type: "text", text: "Band F means high running costs for its size." }],
});

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: createMock };
    },
  };
});

const { createApp } = await import("../../src/app.js");
const app = createApp();

describe("POST /api/buddy/:uprn", () => {
  beforeEach(() => {
    createMock.mockClear();
  });

  it("returns 404 for an unknown building without calling the model", async () => {
    const res = await request(app).post("/api/buddy/999999999999").send({ question: "why?" });
    expect(res.status).toBe(404);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns the model's answer for a known building", async () => {
    const building = await seedBuilding();
    await seedRecommendation(building.uprn);

    const res = await request(app)
      .post(`/api/buddy/${building.uprn}`)
      .send({ question: "Why is this rated F?" });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBe("Band F means high running costs for its size.");
    expect(createMock).toHaveBeenCalledOnce();
  });

  it("never includes the building's validation status in the prompt sent to the model", async () => {
    const building = await seedBuilding({ status: "flagged" });
    await seedRecommendation(building.uprn);

    await request(app).post(`/api/buddy/${building.uprn}`).send({ question: "Is this reliable?" });

    const callArgs = createMock.mock.calls[0][0];
    const userMessage = callArgs.messages[0].content as string;

    expect(userMessage).not.toMatch(/flagged/i);
    expect(userMessage).not.toContain('"status"');
    expect(callArgs.system).toMatch(/do not mention or imply.*(reviewed|verified|flagged)/is);
  });

  it("scopes the prompt to only that building's own data, not other buildings", async () => {
    const buildingA = await seedBuilding({ uprn: 1, address: "Building A", epc_band: "F" });
    await seedBuilding({ uprn: 2, address: "Building B", epc_band: "C" });
    await seedRecommendation(buildingA.uprn);

    await request(app).post(`/api/buddy/${buildingA.uprn}`).send({ question: "Tell me about it" });

    const userMessage = createMock.mock.calls[0][0].messages[0].content as string;
    expect(userMessage).toContain("Building A");
    expect(userMessage).not.toContain("Building B");
  });
});
