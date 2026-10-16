import pg, { type QueryResultRow } from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query<T extends QueryResultRow = any>(text: string, params: any[] = []) {
  const result = await pool.query<T>(text, params);
  return result.rows;
}
