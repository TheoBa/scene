import {
  eventArtists,
  events,
  performances,
  slugify,
  sourceEvents,
  uniqueSlug,
  venues,
  type Db,
} from "@scenes/db";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { enrichResolvedSourceEvents, type EnrichableSourceEvent } from "./enrich.js";

/**
 * Resolve staging `source_events` into the canonical model. This is the
 * ingestion service's ONLY write-contract into the product tables, so all the
 * source-shape quirks are absorbed here:
 *
 *  - A source "event" is really one dated showing → maps to a `performance`.
 *  - A show's run = many source events under the same title → collapse to one
 *    `event` (production), keyed on `slugify(title)` (shared with the seed).
 *  - Sources emit duplicate listings for the same show+venue+date → collapse to a
 *    single `performance` (distinct `(eventId, venueId, startsAt)`).
 *
 * Idempotent: only rows not yet linked to a performance are processed, canonical
 * upserts use conflict-do-nothing (never clobbering curated seed events that share
 * a slug), and re-runs add nothing new. Cross-source dedup (matching a new source's
 * dedupKey onto an existing event) slots in here as a later phase.
 *
 * Runs in two passes:
 *  - Pass 1 (existing flow): venue/event/performance upsert for rows not yet
 *    linked to a performance, then immediately enrich those same rows (image/
 *    ticket/artists) via `enrich.ts` — no extra query, the data's already in
 *    memory.
 *  - Pass 2 (new): re-scan rows that are ALREADY linked to a performance but
 *    still have an enrichment gap (missing poster/ticket link, or no linked
 *    artist). This exists because artist-linking shipped after many rows were
 *    already resolved — without this pass, those rows would be permanently
 *    invisible to enrichment (Pass 1 only ever looks at unresolved rows).
 */

export interface ResolveResult {
  venuesUpserted: number;
  eventsUpserted: number;
  performancesUpserted: number;
  artistsUpserted: number;
  artistsLinked: number;
  eventsEnriched: number;
  linked: number; // source_events newly linked to a performance
  skipped: number; // rows missing title/venue/date — left unresolved for a later pass
}

const perfKey = (eventId: string, venueId: string, startsAt: Date): string =>
  `${eventId}|${venueId}|${startsAt.toISOString()}`;

export async function resolveSourceEvents(db: Db): Promise<ResolveResult> {
  const result: ResolveResult = {
    venuesUpserted: 0,
    eventsUpserted: 0,
    performancesUpserted: 0,
    artistsUpserted: 0,
    artistsLinked: 0,
    eventsEnriched: 0,
    linked: 0,
    skipped: 0,
  };

  // Unresolved = not yet linked to a performance (the final resolution link).
  const todo = await db
    .select({
      id: sourceEvents.id,
      title: sourceEvents.title,
      venueName: sourceEvents.venueName,
      venueAddress: sourceEvents.venueAddress,
      genre: sourceEvents.genre,
      startsAt: sourceEvents.startsAt,
      performers: sourceEvents.performers,
      imageUrl: sourceEvents.imageUrl,
      sourceUrl: sourceEvents.sourceUrl,
      source: sourceEvents.source,
    })
    .from(sourceEvents)
    .where(isNull(sourceEvents.performanceId));

  if (todo.length === 0) return await runEnrichPass2(db, result);

  // Need a title, a venue and a date to place the record.
  const resolvable = todo.filter(
    (r): r is typeof r & { title: string; venueName: string; startsAt: Date } =>
      Boolean(r.title && r.venueName && r.startsAt),
  );
  result.skipped = todo.length - resolvable.length;
  if (resolvable.length === 0) return runEnrichPass2(db, result);

  // Populated inside the transaction below (row id → resolved eventId), read
  // afterwards to build the Pass 1 enrich candidates.
  const rowEventById = new Map<string, string>();

  await db.transaction(async (tx) => {
    // ---- Venues: upsert by unique name (first-seen address as a bonus) ----
    // Slugs are computed here (not left null) so every venue the worker creates
    // is immediately reachable at /salle/[slug] — `uniqueSlug` guards against
    // collisions since venue names collide far more than show titles once
    // slugified. Existing venues' slugs are untouched (onConflictDoNothing).
    const addressByVenue = new Map<string, string | null>();
    for (const r of resolvable) {
      if (!addressByVenue.has(r.venueName)) addressByVenue.set(r.venueName, r.venueAddress ?? null);
    }
    const venueNames = [...addressByVenue.keys()];
    const existingVenueSlugs = await tx.select({ slug: venues.slug }).from(venues);
    const takenVenueSlugs = new Set(existingVenueSlugs.flatMap((v) => (v.slug ? [v.slug] : [])));
    const insertedVenues = await tx
      .insert(venues)
      .values(
        venueNames.map((name) => {
          const slug = uniqueSlug(slugify(name), takenVenueSlugs);
          takenVenueSlugs.add(slug);
          return { name, address: addressByVenue.get(name) ?? null, slug };
        }),
      )
      .onConflictDoNothing()
      .returning({ id: venues.id });
    result.venuesUpserted = insertedVenues.length;
    const venueRows = await tx
      .select({ id: venues.id, name: venues.name })
      .from(venues)
      .where(inArray(venues.name, venueNames));
    const venueIdByName = new Map(venueRows.map((v) => [v.name, v.id]));

    // ---- Events: upsert by slug; NEVER clobber a curated event on conflict ----
    const eventBySlug = new Map<string, { name: string; genre: string | null }>();
    for (const r of resolvable) {
      const slug = slugify(r.title);
      if (slug && !eventBySlug.has(slug)) eventBySlug.set(slug, { name: r.title, genre: r.genre });
    }
    const slugs = [...eventBySlug.keys()];
    if (slugs.length === 0) return; // no placeable titles this pass
    const insertedEvents = await tx
      .insert(events)
      .values(
        slugs.map((slug) => {
          const info = eventBySlug.get(slug)!;
          return { name: info.name, slug, tags: info.genre ? [info.genre] : [] };
        }),
      )
      .onConflictDoNothing()
      .returning({ id: events.id });
    result.eventsUpserted = insertedEvents.length;
    const eventRows = await tx
      .select({ id: events.id, slug: events.slug })
      .from(events)
      .where(inArray(events.slug, slugs));
    const eventIdBySlug = new Map(eventRows.map((e) => [e.slug, e.id]));

    // ---- Performances: one per distinct (event, venue, startsAt) ----
    // Seed the key→id map with performances that already exist for these events,
    // so re-runs and duplicate listings both collapse onto the same row.
    const eventIds = eventRows.map((e) => e.id);
    const perfIdByKey = new Map<string, string>();
    if (eventIds.length) {
      const existing = await tx
        .select({
          id: performances.id,
          eventId: performances.eventId,
          venueId: performances.venueId,
          startsAt: performances.startsAt,
        })
        .from(performances)
        .where(inArray(performances.eventId, eventIds));
      for (const p of existing) perfIdByKey.set(perfKey(p.eventId, p.venueId, p.startsAt), p.id);
    }

    // Resolve each row to (eventId, venueId, key); drop ones we still can't place.
    const rowResolved: { id: string; eventId: string; venueId: string; key: string }[] = [];
    const newPerf = new Map<string, { eventId: string; venueId: string; startsAt: Date }>();
    for (const r of resolvable) {
      const eventId = eventIdBySlug.get(slugify(r.title));
      const venueId = venueIdByName.get(r.venueName);
      if (!eventId || !venueId) continue;
      const key = perfKey(eventId, venueId, r.startsAt);
      rowResolved.push({ id: r.id, eventId, venueId, key });
      if (!perfIdByKey.has(key) && !newPerf.has(key)) {
        newPerf.set(key, { eventId, venueId, startsAt: r.startsAt });
      }
    }

    if (newPerf.size) {
      const inserted = await tx
        .insert(performances)
        .values([...newPerf.values()])
        .returning({
          id: performances.id,
          eventId: performances.eventId,
          venueId: performances.venueId,
          startsAt: performances.startsAt,
        });
      for (const p of inserted) perfIdByKey.set(perfKey(p.eventId, p.venueId, p.startsAt), p.id);
      result.performancesUpserted = inserted.length;
    }

    // ---- Write the canonical ids back onto source_events, grouped by performance ----
    const byPerf = new Map<string, { eventId: string; venueId: string; ids: string[] }>();
    for (const rr of rowResolved) {
      const performanceId = perfIdByKey.get(rr.key);
      if (!performanceId) continue;
      const g = byPerf.get(performanceId) ?? { eventId: rr.eventId, venueId: rr.venueId, ids: [] };
      g.ids.push(rr.id);
      byPerf.set(performanceId, g);
    }
    for (const [performanceId, g] of byPerf) {
      await tx
        .update(sourceEvents)
        .set({ eventId: g.eventId, venueId: g.venueId, performanceId })
        .where(inArray(sourceEvents.id, g.ids));
      result.linked += g.ids.length;
    }

    // Stash resolved (row → eventId) pairs for the enrich call below — the
    // transaction closure can't return early with a value here (the `return`
    // above is the "no placeable titles" bail-out), so capture via the outer
    // `rowEventById` map instead.
    for (const rr of rowResolved) rowEventById.set(rr.id, rr.eventId);
  });

  // ---- Enrich the rows resolved in THIS pass immediately (image/ticket/
  // attribution + artists) — reuses the in-memory `resolvable` data, no extra
  // query. See enrich.ts.
  const pass1Candidates: EnrichableSourceEvent[] = [];
  for (const r of resolvable) {
    const eventId = rowEventById.get(r.id);
    if (!eventId) continue;
    pass1Candidates.push({
      eventId,
      imageUrl: r.imageUrl,
      sourceUrl: r.sourceUrl,
      performers: r.performers,
      source: r.source,
    });
  }
  const enrich1 = await enrichResolvedSourceEvents(db, pass1Candidates);
  result.eventsEnriched += enrich1.eventsEnriched;
  result.artistsUpserted += enrich1.artistsUpserted;
  result.artistsLinked += enrich1.artistsLinked;

  console.log(
    `[resolve] ${result.linked} rows linked → ${result.eventsUpserted} new events, ` +
      `${result.venuesUpserted} new venues, ${result.performancesUpserted} new performances, ` +
      `${result.artistsUpserted} new artists (${result.skipped} skipped: missing title/venue/date)`,
  );

  return runEnrichPass2(db, result);
}

/**
 * Pass 2 — re-scan source_events already linked to a performance but still
 * missing enrichment (no poster/ticket link on the event, or no linked
 * artist). Self-cleaning: once an event's imageUrl/ticketUrl are filled and it
 * has at least one linked artist, it drops out of this query on its own — no
 * separate "enrichedAt" bookkeeping column needed at this scale. One accepted
 * quirk: an event that will genuinely never get a ticket URL (fully
 * hand-curated show, no online seller) stays in this query forever — harmless
 * (cheap no-op patch), not worth engineering around (see plan).
 */
async function runEnrichPass2(db: Db, result: ResolveResult): Promise<ResolveResult> {
  const rows = await db
    .select({
      eventId: sourceEvents.eventId,
      imageUrl: sourceEvents.imageUrl,
      sourceUrl: sourceEvents.sourceUrl,
      performers: sourceEvents.performers,
      source: sourceEvents.source,
    })
    .from(sourceEvents)
    .innerJoin(events, eq(sourceEvents.eventId, events.id))
    .leftJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .where(
      and(
        isNotNull(sourceEvents.performanceId),
        or(isNull(events.imageUrl), isNull(events.ticketUrl), isNull(eventArtists.id)),
      ),
    );

  // Dedupe to one candidate per eventId — any TM row for a show carries the
  // same poster/url/cast in practice, so first-seen wins.
  const byEvent = new Map<string, EnrichableSourceEvent>();
  for (const r of rows) {
    if (!r.eventId || byEvent.has(r.eventId)) continue;
    byEvent.set(r.eventId, {
      eventId: r.eventId,
      imageUrl: r.imageUrl,
      sourceUrl: r.sourceUrl,
      performers: r.performers,
      source: r.source,
    });
  }

  const enrich2 = await enrichResolvedSourceEvents(db, [...byEvent.values()]);
  result.eventsEnriched += enrich2.eventsEnriched;
  result.artistsUpserted += enrich2.artistsUpserted;
  result.artistsLinked += enrich2.artistsLinked;

  if (enrich2.eventsEnriched || enrich2.artistsLinked) {
    console.log(
      `[resolve] pass 2: ${enrich2.eventsEnriched} already-linked events enriched, ` +
        `${enrich2.artistsUpserted} new artists, ${enrich2.artistsLinked} artist links`,
    );
  }

  return result;
}
