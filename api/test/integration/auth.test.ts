import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { seedAdminUser } from "../helpers.js";

const app = createApp();

describe("POST /api/auth/login", () => {
  it("rejects an email that doesn't exist", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@northumbria.ac.uk", password: "whatever" });
    expect(res.status).toBe(401);
  });

  it("rejects a wrong password for a real account", async () => {
    const user = await seedAdminUser();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("accepts a correct email/password and returns a token plus role", async () => {
    const user = await seedAdminUser("reviewer@northumbria.ac.uk", "correcthorse", "reviewer");

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.role).toBe("reviewer");

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET!) as any;
    expect(decoded.email).toBe("reviewer@northumbria.ac.uk");
    expect(decoded.role).toBe("reviewer");
  });

  it("ignores any role field the client tries to send — role only ever comes from the stored account", async () => {
    const user = await seedAdminUser("reviewer2@northumbria.ac.uk", "pw123456", "reviewer");

    // Client attempts to smuggle in an elevated role alongside real credentials.
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password, role: "administrator" });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("reviewer"); // not "administrator"
  });
});
