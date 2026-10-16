import { Router } from "express";
import { query } from "../db/client.js";
import { type AuthedRequest, requireAuth } from "../middleware/requireAuth.js";

export const adminRouter = Router();
adminRouter.use(requireAuth);

// GET /api/admin/buildings?status=unverified — powers the queue list and counts
adminRouter.get("/buildings", async (req, res) => {
  const { status } = req.query;
  const rows = status
    ? await query(
        `SELECT uprn, address, epc_band, status, osm_feature_id FROM hereditaments WHERE status = $1 ORDER BY address`,
        [status]
      )
    : await query(`SELECT uprn, address, epc_band, status, osm_feature_id FROM hereditaments ORDER BY address`);
  res.json(rows);
});

// GET /api/admin/queue-counts — the sidebar counts (all / unverified / verified / flagged / reported)
adminRouter.get("/queue-counts", async (_req, res) => {
  const rows = await query(
    `SELECT status, count(*)::int AS count FROM hereditaments GROUP BY status`
  );
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  res.json({ all: total, ...Object.fromEntries(rows.map((r) => [r.status, r.count])) });
});

adminRouter.post("/buildings/:uprn/verify", async (req, res) => {
  await query(`UPDATE hereditaments SET status = 'verified', updated_at = now() WHERE uprn = $1`, [
    req.params.uprn,
  ]);
  res.json({ status: "verified" });
});

adminRouter.post("/buildings/:uprn/flag", async (req, res) => {
  await query(`UPDATE hereditaments SET status = 'flagged', updated_at = now() WHERE uprn = $1`, [
    req.params.uprn,
  ]);
  res.json({ status: "flagged" });
});

adminRouter.post("/buildings/:uprn/notes", async (req: AuthedRequest, res) => {
  const { note } = req.body;
  await query(
    `INSERT INTO review_notes (uprn, admin_user, note) VALUES ($1, $2, $3)`,
    [req.params.uprn, req.user!.email, note]
  );
  res.json({ received: true });
});

// PUT /api/admin/recommendations/:id — the recommendation edit form's endpoint.
// `source` is set explicitly by the admin, not inferred automatically.
adminRouter.put("/recommendations/:id", async (req, res) => {
  const { measure, payback_category, estimated_cost, source } = req.body;
  await query(
    `UPDATE recommendations
     SET measure = $1, payback_category = $2, estimated_cost = $3, source = $4
     WHERE id = $5`,
    [measure, payback_category, estimated_cost, source, req.params.id]
  );

  if (source === "manual_override") {
    await query(
      `UPDATE hereditaments SET status = 'superseded', updated_at = now()
       WHERE uprn = (SELECT uprn FROM recommendations WHERE id = $1)`,
      [req.params.id]
    );
  }

  res.json({ updated: true });
});

// GET /api/admin/reports — general feedback inbox (uprn IS NULL only;
// building-specific reports already surface as status = 'reported' above)
adminRouter.get("/reports", async (_req, res) => {
  const rows = await query(
    `SELECT id, message, reporter_email, created_at, resolved
     FROM issue_reports WHERE uprn IS NULL ORDER BY created_at DESC`
  );
  res.json(rows);
});
