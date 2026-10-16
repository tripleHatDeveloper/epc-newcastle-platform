// Creates or updates an admin account. Usage:
//   npx tsx src/etl/createAdminUser.ts you@northumbria.ac.uk your_password administrator
//
// Role is either "administrator" or "reviewer" — see schema.sql's check
// constraint on admin_users.role.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool, query } from "../db/client.js";

async function main() {
  const [, , email, password, role = "administrator"] = process.argv;

  if (!email || !password) {
    console.error("Usage: npx tsx src/etl/createAdminUser.ts <email> <password> [role]");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await query(
    `INSERT INTO admin_users (email, password_hash, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
    [email, passwordHash, role]
  );

  console.log(`Admin account ready: ${email} (${role})`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
