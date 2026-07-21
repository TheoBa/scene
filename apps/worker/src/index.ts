import cron from "node-cron";
import { createDb } from "@scenes/db";
import { ingestOpenAgenda } from "./sources/openagenda.js";
import { ingestDataTourisme } from "./sources/datatourisme.js";
import { ingestFranceBillet } from "./sources/francebillet.js";

const db = createDb();

async function runIngestion() {
  console.log(`[worker] ingestion run started ${new Date().toISOString()}`);
  const results = await Promise.allSettled([
    ingestOpenAgenda(db),
    ingestDataTourisme(db),
    ingestFranceBillet(db),
  ]);
  results.forEach((r, i) => {
    const name = ["openagenda", "datatourisme", "francebillet"][i];
    if (r.status === "rejected") console.error(`[worker] ${name} failed:`, r.reason);
    else console.log(`[worker] ${name}: ${r.value.upserted} pieces upserted`);
  });
  // TODO: entity resolution / dedup pass across sources (match on title+venue+dates)
  console.log(`[worker] ingestion run finished ${new Date().toISOString()}`);
}

if (process.argv.includes("--once")) {
  runIngestion().then(() => process.exit(0));
} else {
  // Daily at 05:00 Europe/Paris — before the morning traffic
  cron.schedule("0 5 * * *", runIngestion, { timezone: "Europe/Paris" });
  console.log("[worker] scheduled daily ingestion at 05:00 Europe/Paris");
}
