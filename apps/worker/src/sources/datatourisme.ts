import type { Db } from "@scenes/db";

/**
 * DATAtourisme — national open-data platform, Licence Ouverte 2.0, daily updates.
 * API: https://api.datatourisme.fr (requires registration; key in DATATOURISME_API_KEY)
 * Strategy: filter cultural events / theatre category, Île-de-France first.
 */
export async function ingestDataTourisme(_db: Db): Promise<{ upserted: number }> {
  // TODO: implement fetch + upsert
  return { upserted: 0 };
}
