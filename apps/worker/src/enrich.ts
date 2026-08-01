import { artists, eventArtists, events, slugify, uniqueSlug, type Db } from "@scenes/db";
import { eq, inArray } from "drizzle-orm";

/**
 * Enrichment shared by both `resolve.ts`'s two passes (see there) and, later,
 * the one-off backfill (Plan B): given already-resolved `(eventId ↔ source
 * event)` pairs, fill the `events` table's image/ticket/attribution columns and
 * upsert+link artists from `performers` — all without ever clobbering curated
 * data. Lives as its own module (not folded into `resolve.ts`) so a future
 * caller (the backfill script) has a small, obviously-reusable import surface
 * instead of pulling in all of `resolve.ts`'s venue/event/performance upsert
 * orchestration.
 */

export interface EnrichableSourceEvent {
  eventId: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  performers: string[] | null;
  source: string; // e.g. 'ticketmaster'
}

export interface EnrichResult {
  eventsEnriched: number; // events where imageUrl/ticketUrl/sourceAttribution was filled
  artistsUpserted: number; // new artists created while linking these rows
  artistsLinked: number; // new eventArtists rows created
}

export async function enrichResolvedSourceEvents(
  db: Db,
  candidates: EnrichableSourceEvent[],
): Promise<EnrichResult> {
  const result: EnrichResult = { eventsEnriched: 0, artistsUpserted: 0, artistsLinked: 0 };
  if (candidates.length === 0) return result;

  await db.transaction(async (tx) => {
    // ---- Events columns: never clobber a curated imageUrl/ticketUrl ----
    // Per-row UPDATE is fine at this scale (~787 rows today) — no bulk SQL trick
    // needed (see plan). Only touch a field that's currently null.
    const eventIds = [...new Set(candidates.map((c) => c.eventId))];
    const currentEvents = await tx
      .select({
        id: events.id,
        imageUrl: events.imageUrl,
        ticketUrl: events.ticketUrl,
        imageSource: events.imageSource,
        ticketSource: events.ticketSource,
      })
      .from(events)
      .where(inArray(events.id, eventIds));
    const eventById = new Map(currentEvents.map((e) => [e.id, e]));

    for (const c of candidates) {
      const current = eventById.get(c.eventId);
      if (!current) continue;

      const nextImageUrl = current.imageUrl ?? c.imageUrl ?? null;
      const nextTicketUrl = current.ticketUrl ?? c.sourceUrl ?? null;
      const imageFilled = current.imageUrl === null && nextImageUrl !== null;
      const ticketFilled = current.ticketUrl === null && nextTicketUrl !== null;
      if (!imageFilled && !ticketFilled) continue;

      // Stamped independently per field — a show can be curated in one field
      // and ingestion-filled in the other (see schema.ts comment).
      const nextImageSource = imageFilled ? c.source : current.imageSource;
      const nextTicketSource = ticketFilled ? c.source : current.ticketSource;
      await tx
        .update(events)
        .set({
          imageUrl: nextImageUrl,
          ticketUrl: nextTicketUrl,
          imageSource: nextImageSource,
          ticketSource: nextTicketSource,
        })
        .where(eq(events.id, c.eventId));
      result.eventsEnriched += 1;
      // Keep the in-memory snapshot current in case a later candidate in this
      // same batch targets the same event (dedup happens upstream, but cheap
      // to be defensive here too).
      eventById.set(c.eventId, {
        id: current.id,
        imageUrl: nextImageUrl,
        ticketUrl: nextTicketUrl,
        imageSource: nextImageSource,
        ticketSource: nextTicketSource,
      });
    }

    // ---- Artists: upsert by unique name from performers, same pattern as the
    // venue/event upserts in resolve.ts ----
    const artistNames = new Set<string>();
    for (const c of candidates) {
      for (const name of c.performers ?? []) {
        const trimmed = name.trim();
        if (trimmed) artistNames.add(trimmed);
      }
    }

    const existingArtists = await tx
      .select({ id: artists.id, name: artists.name, slug: artists.slug })
      .from(artists);
    const takenArtistSlugs = new Set(existingArtists.map((a) => a.slug));
    const artistIdByName = new Map(existingArtists.map((a) => [a.name, a.id]));
    const newArtistNames = [...artistNames].filter((name) => !artistIdByName.has(name));
    if (newArtistNames.length) {
      const insertedArtists = await tx
        .insert(artists)
        .values(
          newArtistNames.map((name) => {
            const slug = uniqueSlug(slugify(name), takenArtistSlugs);
            takenArtistSlugs.add(slug);
            return { name, slug };
          }),
        )
        .onConflictDoNothing()
        .returning({ id: artists.id, name: artists.name });
      result.artistsUpserted = insertedArtists.length;
      for (const a of insertedArtists) artistIdByName.set(a.name, a.id);
    }

    // ---- Event ↔ Artist links, deduped via the unique(eventId, artistId) constraint ----
    const eventArtistPairs = new Map<string, { eventId: string; artistId: string }>();
    for (const c of candidates) {
      for (const name of c.performers ?? []) {
        const artistId = artistIdByName.get(name.trim());
        if (!artistId) continue;
        eventArtistPairs.set(`${c.eventId}|${artistId}`, { eventId: c.eventId, artistId });
      }
    }
    if (eventArtistPairs.size) {
      const insertedLinks = await tx
        .insert(eventArtists)
        .values([...eventArtistPairs.values()])
        .onConflictDoNothing()
        .returning({ id: eventArtists.id });
      result.artistsLinked = insertedLinks.length;
    }
  });

  return result;
}
