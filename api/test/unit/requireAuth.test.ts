import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import { requireAuth } from "../../src/middleware/requireAuth.js";

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("requireAuth middleware", () => {
  it("rejects a request with no Authorization header", () => {
    const req: any = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Sign in required." });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a header that isn't a Bearer token", () => {
    const req: any = { headers: { authorization: "Basic abc123" } };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an invalid or expired token", () => {
    const req: any = { headers: { authorization: "Bearer not-a-real-token" } };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Your session expired. Sign in again." });
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts a valid token and attaches the decoded user, including role", () => {
    const token = jwt.sign(
      { email: "reviewer@northumbria.ac.uk", role: "reviewer" },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({ email: "reviewer@northumbria.ac.uk", role: "reviewer" });
  });

  it("never trusts a role claimed by the client outside the signed token", () => {
    // A forged/tampered token (wrong secret) must be rejected outright —
    // there is no path where role can be smuggled in unsigned.
    const forged = jwt.sign({ email: "attacker@example.com", role: "administrator" }, "wrong-secret");
    const req: any = { headers: { authorization: `Bearer ${forged}` } };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
