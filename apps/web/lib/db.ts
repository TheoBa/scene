import { createDb, type Db } from "@scenes/db";

// One pooled connection for the whole web process. Call getDb() everywhere
// instead of createDb() directly — createDb() opens a fresh pg.Pool each time,
// which would leak connections on the long-running standalone server.
let cached: Db | undefined;

export function getDb(): Db {
  if (!cached) cached = createDb();
  return cached;
}
