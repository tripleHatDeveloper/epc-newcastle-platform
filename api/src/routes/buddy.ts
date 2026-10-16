import Anthropic from "@anthropic-ai/sdk";
import { Router } from "express";
import { query } from "../db/client.js";

export const buddyRouter = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are EPC buddy, explaining building energy performance data to the
public on Newcastle's EPC building explorer. You are given one building's record (band, floor
area, property type, recommended works, payback category). Answer only using that record and
general, widely-known facts about how EPC ratings and MEES targets work. Do not mention or imply
anything about whether the record has been reviewed, verified, or flagged internally — that is
not part of the data you're given and is not your concern. Keep answers short, plain, and
specific to the building asked about.`;

// POST /api/buddy/:uprn — public, no auth. Scoped to one building's data only.
buddyRouter.post("/:uprn", async (req, res) => {
  const { question } = req.body;
  const uprn = Number(req.params.uprn);

  // Deliberately select only public-facing fields — status is excluded
  // so it can never leak into the assistant's context.
  const [building] = await query(
    `SELECT address, property_type, floor_area_sqm, epc_band FROM hereditaments WHERE uprn = $1`,
    [uprn]
  );
  if (!building) {
    return res.status(404).json({ error: "No building found with that reference." });
  }

  const recommendations = await query(
    `SELECT measure, payback_category FROM recommendations WHERE uprn = $1`,
    [uprn]
  );

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Building record: ${JSON.stringify({ ...building, recommendations })}\n\nQuestion: ${question}`,
      },
    ],
  });

  const answer = message.content.find((b) => b.type === "text")?.text ?? "";
  res.json({ answer });
});
