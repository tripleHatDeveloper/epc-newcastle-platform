import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { pool } from "../../src/db/client.js";
import { seedBuilding } from "../helpers.js";

const app = createApp();

describe("POST /api/reports", () => {
  it("rejects a submission with no message", async () => {
    const res = await request(app).post("/api/reports").send({});
    expect(res.status).toBe(400);
  });

  it("records general feedback with a null uprn and does not touch any building", async () => {
    await seedBuilding();

    const res = await request(app).post("/api/reports").send({ message: "Love the map!" });

    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT uprn, message FROM issue_reports`);
    expect(rows).toHaveLength(1);
    expect(rows[0].uprn).toBeNull();
    expect(rows[0].message).toBe("Love the map!");

    const [building] = (await pool.query(`SELECT status FROM hereditaments`)).rows;
    expect(building.status).toBe("unverified"); // unchanged
  });

  it("records a building-specific report and flips that building's status to reported", async () => {
    const building = await seedBuilding();

    const res = await request(app)
      .post("/api/reports")
      .send({ uprn: building.uprn, message: "This building was demolished." });

    expect(res.status).toBe(200);

    const [row] = (await pool.query(`SELECT status FROM hereditaments WHERE uprn = $1`, [building.uprn]))
      .rows;
    expect(row.status).toBe("reported");

    const [report] = (await pool.query(`SELECT uprn FROM issue_reports`)).rows;
    expect(Number(report.uprn)).toBe(building.uprn);
  });

  it("stores the optional email when provided, and leaves it null when not", async () => {
    await request(app).post("/api/reports").send({ message: "no email given" });
    await request(app)
      .post("/api/reports")
      .send({ message: "with email", email: "person@example.com" });

    const { rows } = await pool.query(
      `SELECT message, reporter_email FROM issue_reports ORDER BY id`
    );
    expect(rows[0].reporter_email).toBeNull();
    expect(rows[1].reporter_email).toBe("person@example.com");
  });
});
