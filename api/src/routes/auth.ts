import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { query } from "../db/client.js";

export const authRouter = Router();

// POST /api/auth/login — the only route the login screen calls.
// The user never selects a role; it's read from admin_users.role.
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const [user] = await query(
    `SELECT email, password_hash, role FROM admin_users WHERE email = $1`,
    [email]
  );

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "That email or password is incorrect." });
  }

  const token = jwt.sign(
    { email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "8h" }
  );

  res.json({ token, role: user.role });
});
