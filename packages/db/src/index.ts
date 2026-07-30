import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as domain from "./schema";
import * as authTables from "./auth-schema";

export * from "./schema";
export * from "./auth-schema";
export * from "./slug";

// Drizzle needs every table (domain + better-auth's) to resolve relations.
const schema = { ...domain, ...authTables };

export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const pool = new pg.Pool({ connectionString });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
