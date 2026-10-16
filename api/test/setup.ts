import fs from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach } from "vitest";
import { pool } from "../src/db/client.js";

beforeAll(async () => {
  const schemaPath = path.resolve(__dirname, "../src/db/schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  await pool.query(schema);
});

// Every test starts from a clean slate — truncating rather than dropping
// tables keeps this fast and avoids re-running schema.sql per test.
beforeEach(async () => {
  await pool.query(
    `TRUNCATE hereditaments, recommendations, review_notes, issue_reports, admin_users RESTART IDENTITY CASCADE`
  );
});
