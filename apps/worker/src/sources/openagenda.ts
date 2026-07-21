import type { Db } from "@scenes/db";

/**
 * OpenAgenda — open licence, schema.org events.
 * Docs: https://developers.openagenda.com/
 * Strategy: query Paris theatre agendas, upsert pieces keyed on (source, sourceRef).
 */
export async function ingestOpenAgenda(_db: Db): Promise<{ upserted: number }> {
  // TODO: implement fetch + upsert
  return { upserted: 0 };
}
