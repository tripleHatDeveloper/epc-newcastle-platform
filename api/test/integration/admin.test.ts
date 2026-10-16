import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { pool } from "../../src/db/client.js";
import { seedBuilding, seedRecommendation } from "../helpers.js";

const app = createApp();

function tokenFor(role: "reviewer" | "administrator" = "administrator") {
  return jwt.sign({ email: "admin@northumbria.ac.uk", role }, process.env.JWT_SECRET!);
}

describe("admin routes require authentication", () => {
  it("rejects every admin route with no token", async () => {
    const building = await seedBuilding();

    const routes = [
      request(app).get("/api/admin/buildings"),
      request(app).get("/api/admin/queue-counts"),
      request(app).post(`/api/admin/buildings/${building.uprn}/verify`),
      request(app).post(`/api/admin/buildings/${building.uprn}/flag`),
      request(app).get("/api/admin/reports"),
    ];

    const results = await Promise.all(routes);
    for (const res of results) {
      expect(res.status).toBe(401);
    }
  });

  it("rejects a tampered token signed with the wrong secret", async () => {
    const forged = jwt.sign({ email: "attacker@example.com", role: "administrator" }, "wrong-secret");
    const res = await request(app)
      .get("/api/admin/buildings")
      .set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/buildings", () => {
  it("filters by status", async () => {
    await seedBuilding({ uprn: 1, address: "A", status: "unverified" });
    await seedBuilding({ uprn: 2, address: "B", status: "flagged" });

    const res = await request(app)
      .get("/api/admin/buildings")
      .query({ status: "flagged" })
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].address).toBe("B");
  });

  it("includes osm_feature_id, which the admin map view depends on for coloring and click-to-select", async () => {
    await seedBuilding({ uprn: 1, address: "A", osm_feature_id: 12345 });

    const res = await request(app)
      .get("/api/admin/buildings")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(res.body[0]).toHaveProperty("osm_feature_id");
    expect(String(res.body[0].osm_feature_id)).toBe("12345");
  });
});

describe("GET /api/admin/queue-counts", () => {
  it("tallies counts per status correctly, including zero for absent statuses", async () => {
    await seedBuilding({ uprn: 1, status: "unverified" });
    await seedBuilding({ uprn: 2, status: "unverified" });
    await seedBuilding({ uprn: 3, status: "flagged" });

    const res = await request(app)
      .get("/api/admin/queue-counts")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(res.body.all).toBe(3);
    expect(res.body.unverified).toBe(2);
    expect(res.body.flagged).toBe(1);
    expect(res.body.verified).toBeUndefined(); // none seeded — frontend defaults this to 0
  });
});

describe("POST /api/admin/buildings/:uprn/verify and /flag", () => {
  it("verify sets status to verified", async () => {
    const building = await seedBuilding({ status: "unverified" });

    const res = await request(app)
      .post(`/api/admin/buildings/${building.uprn}/verify`)
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(res.status).toBe(200);
    const [row] = (await pool.query(`SELECT status FROM hereditaments WHERE uprn = $1`, [building.uprn]))
      .rows;
    expect(row.status).toBe("verified");
  });

  it("flag sets status to flagged", async () => {
    const building = await seedBuilding({ status: "unverified" });

    await request(app)
      .post(`/api/admin/buildings/${building.uprn}/flag`)
      .set("Authorization", `Bearer ${tokenFor()}`);

    const [row] = (await pool.query(`SELECT status FROM hereditaments WHERE uprn = $1`, [building.uprn]))
      .rows;
    expect(row.status).toBe("flagged");
  });
});

describe("POST /api/admin/buildings/:uprn/notes", () => {
  it("stores a note against the correct building, attributed to the signed-in admin", async () => {
    const building = await seedBuilding();

    const res = await request(app)
      .post(`/api/admin/buildings/${building.uprn}/notes`)
      .set("Authorization", `Bearer ${tokenFor("reviewer")}`)
      .send({ note: "Checked against Google Street View, looks correct." });

    expect(res.status).toBe(200);
    const [row] = (
      await pool.query(`SELECT admin_user, note FROM review_notes WHERE uprn = $1`, [building.uprn])
    ).rows;
    expect(row.admin_user).toBe("admin@northumbria.ac.uk");
    expect(row.note).toBe("Checked against Google Street View, looks correct.");
  });
});

describe("PUT /api/admin/recommendations/:id", () => {
  it("updates the recommendation fields", async () => {
    const building = await seedBuilding();
    const rec = await seedRecommendation(building.uprn);

    const res = await request(app)
      .put(`/api/admin/recommendations/${rec.id}`)
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({
        measure: "Wall insulation",
        payback_category: "long",
        estimated_cost: 25000,
        source: "epc_assessor",
      });

    expect(res.status).toBe(200);
    const [row] = (await pool.query(`SELECT measure, payback_category FROM recommendations WHERE id = $1`, [
      rec.id,
    ])).rows;
    expect(row.measure).toBe("Wall insulation");
    expect(row.payback_category).toBe("long");
  });

  it("flips the building's status to superseded only when source is manual_override", async () => {
    const building = await seedBuilding({ status: "verified" });
    const rec = await seedRecommendation(building.uprn);

    // A small correction, still sourced from the assessor — should NOT supersede.
    await request(app)
      .put(`/api/admin/recommendations/${rec.id}`)
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ measure: "LED lighting (corrected typo)", payback_category: "medium", estimated_cost: 18500, source: "epc_assessor" });

    let [row] = (await pool.query(`SELECT status FROM hereditaments WHERE uprn = $1`, [building.uprn])).rows;
    expect(row.status).toBe("verified"); // unchanged

    // A genuine manual override — should supersede.
    await request(app)
      .put(`/api/admin/recommendations/${rec.id}`)
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ measure: "Full re-glazing", payback_category: "long", estimated_cost: 40000, source: "manual_override" });

    [row] = (await pool.query(`SELECT status FROM hereditaments WHERE uprn = $1`, [building.uprn])).rows;
    expect(row.status).toBe("superseded");
  });
});

describe("GET /api/admin/reports", () => {
  it("only returns general feedback (uprn IS NULL), not building-specific reports", async () => {
    const building = await seedBuilding();
    await pool.query(`INSERT INTO issue_reports (uprn, message) VALUES ($1, $2)`, [
      building.uprn,
      "building-specific report",
    ]);
    await pool.query(`INSERT INTO issue_reports (uprn, message) VALUES (NULL, $1)`, [
      "general feedback",
    ]);

    const res = await request(app)
      .get("/api/admin/reports")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].message).toBe("general feedback");
  });
});
