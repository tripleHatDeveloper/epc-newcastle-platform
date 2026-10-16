import "dotenv/config";
import { fetchEpcRegister } from "./fetchEpcRegister.js";
import { joinOsmGeometry } from "./joinOsmGeometry.js";

// Scheduled entry point (cron / GitHub Actions / task scheduler) that
// automates the filtering pilot described in the original brief:
// pull fresh EPC records, join them to building geometry, upsert into
// hereditaments + recommendations. Re-run on a schedule since EPCs
// expire after 10 years and new ones are lodged continuously.
async function run() {
  console.log("Fetching EPC register records for Newcastle (E08000021)...");
  const records = await fetchEpcRegister();

  console.log(`Fetched ${records.length} records. Matching to building geometry...`);
  await joinOsmGeometry(records);

  console.log("ETL run complete.");
}

run().catch((err) => {
  console.error("ETL run failed:", err);
  process.exit(1);
});
