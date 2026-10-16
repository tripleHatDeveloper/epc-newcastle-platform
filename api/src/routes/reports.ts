import { Router } from "express";
import { query } from "../db/client.js";

export const reportsRouter = Router();

// POST /api/reports — public, no auth. One form, two contexts:
// `uprn` present -> flows into the admin review queue as status "reported".
// `uprn` absent  -> general feedback, only visible via /api/admin/reports.
reportsRouter.post("/", async (req, res) => {
  const { uprn, message, email } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Enter a message before submitting." });
  }

  await query(
    `INSERT INTO issue_reports (uprn, message, reporter_email) VALUES ($1, $2, $3)`,
    [uprn ?? null, message.trim(), email || null]
  );

  if (uprn) {
    await query(
      `UPDATE hereditaments SET status = 'reported', updated_at = now() WHERE uprn = $1`,
      [uprn]
    );
  }

  res.json({ received: true });
});
