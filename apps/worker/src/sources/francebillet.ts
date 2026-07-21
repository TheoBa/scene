import type { Db } from "@scenes/db";

/**
 * France Billet / Fnac Spectacles — affiliate XML feed via Awin (daily updates).
 * Requires an approved Awin publisher account; feed URL in FRANCEBILLET_FEED_URL.
 * Strategy: parse XML, filter théâtre/humour, upsert pieces + ticketing_offers
 * with affiliate-decorated URLs.
 */
export async function ingestFranceBillet(_db: Db): Promise<{ upserted: number }> {
  // TODO: implement fetch + upsert (blocked on Awin approval)
  return { upserted: 0 };
}
