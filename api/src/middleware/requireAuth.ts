import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthedRequest extends Request {
  user?: { email: string; role: "reviewer" | "administrator" };
}

// Role is never chosen by the client — it's decoded from a signed token
// issued at login, based on what's stored in admin_users.role.
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Sign in required." });
  }

  try {
    const token = header.slice("Bearer ".length);
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthedRequest["user"];
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Your session expired. Sign in again." });
  }
}
