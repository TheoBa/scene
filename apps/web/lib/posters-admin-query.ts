import { asc, ilike } from "drizzle-orm";
import { events } from "@scenes/db";
import { getDb } from "./db";

// Server-only read side of the /dev/posters admin tool.

export interface ShowPosterRow {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
}

const MAX_RESULTS = 30;

export async function searchShowsForPosterUpload(query: string): Promise<ShowPosterRow[]> {
  const pattern = `%${query.trim()}%`;
  return getDb()
    .select({ id: events.id, slug: events.slug, name: events.name, imageUrl: events.imageUrl })
    .from(events)
    .where(ilike(events.name, pattern))
    .orderBy(asc(events.name))
    .limit(MAX_RESULTS);
}
