import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  primaryKey,
  unique,
  index,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";

// Lean POC schema — logical domains in the public namespace: Venues, Events,
// Performances, Artists. Kept concise; columns are added when a feature needs
// them (e.g. lat/lng once the map lands, provenance once ingestion returns).

// ---------- Venues ----------
// Always-on: a venue row exists once any show references it (ingestion/seed),
// not only once a human creates a page. Gets its own page at /salle/[slug],
// followable (`venueFollows`) and claimable (`claimedByUserId`, via `claims`).

export const venues = pgTable("venues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  // Readable, crawlable URL key (/salle/le-theatre-x). Nullable for now: unlike
  // `events` (created fresh with a seed), `venues` already has populated rows in
  // every environment. This lands nullable, gets backfilled once deployed by
  // `packages/db/seed/backfill-venue-slugs.ts`, and only THEN — once staging is
  // confirmed backfilled — does a small follow-up PR tighten this to
  // notNull().unique() with its own migration. Splitting into two PRs (rather
  // than two migrations in one PR) matters here: this repo applies all pending
  // migrations in a single `npm run db:migrate` invocation, so a NOT NULL
  // migration committed alongside this one would run before the backfill has a
  // chance to execute, and fail against staging's existing venue rows.
  slug: text("slug").unique(),
  address: text("address"),
  // Geocoded from `address` by `packages/db/seed/backfill-venue-lats-lngs.ts`.
  // Nullable like `slug` above: existing venues predate this column, so it
  // lands empty and gets filled by the backfill script, not a migration.
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  bio: text("bio"), // free-text description; self-editable once claimed
  imageUrl: text("image_url"), // venue photo; same convention as events.imageUrl
  officialUrl: text("official_url"), // the venue's own website
  // Set once a claim (see `claims`) is approved. Nullable = unclaimed.
  claimedByUserId: text("claimed_by_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Events (a show/production) ----------
// Deliberately holds no venue or date — those live on `performances`, so a show
// that tours several venues or plays many nights is modelled correctly.

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Readable, crawlable URL key (/shows/le-malade-imaginaire). Generated from the
  // name at seed time; becomes the canonical piece-page slug.
  slug: text("slug").notNull().unique(),
  // Curated production metadata (from the manual catalogue). All optional so a
  // sparsely-known show still fits.
  author: text("author"), // auteur / playwright
  director: text("director"), // metteur en scène / compagnie
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`), // free descriptive tags (genre-ish)
  durationMinutes: integer("duration_minutes"),
  imageUrl: text("image_url"), // poster; a bare filename for now, not rendered yet
  officialUrl: text("official_url"), // the venue's official page for the show
  ticketUrl: text("ticket_url"), // buy/detail link (today: TM's event.url only)
  // Per-field provenance — set only when that specific column was filled from an
  // ingestion source rather than curated by hand, e.g. 'ticketmaster' or 'manual'.
  // Kept separate (not one shared column) because a show can be curated in one
  // field and ingestion-filled in the other, e.g. a hand-picked poster on a show
  // that also gets a real Ticketmaster buy link — collapsing them into one column
  // previously caused a real bug where a poster-specific cleanup script nuked a
  // curated poster after only the ticket link had been ingestion-filled.
  imageSource: text("image_source"),
  ticketSource: text("ticket_source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Performances (one row per individual showing) ----------

export const performances = pgTable("performances", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  // Full timestamp so it carries the showtime (evening / matinée), not just a day.
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Artists (a performer/company appearing in a show) ----------
// Always-on like `venues`: auto-populated by the worker's resolve step from
// `sourceEvents.performers` (Ticketmaster only, for now) and by the seed's
// `events.author`/`director` fields — see resolve.ts and seed/index.ts. Linked
// to events via `eventArtists` (many-to-many). Own page at /artiste/[slug],
// followable (`artistFollows`) and claimable (`claimedByUserId`, via `claims`).
// No person/company distinction in v1 — mirrors how `events.director` already
// conflates "metteur en scène" and "compagnie" in one free-text column.

export const artists = pgTable("artists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  // Created fresh (no populated rows to migrate), so notNull().unique() from
  // day one — unlike `venues.slug`, which needs a backfill window.
  slug: text("slug").notNull().unique(),
  bio: text("bio"),
  imageUrl: text("image_url"),
  officialUrl: text("official_url"),
  // Filled by `packages/db/seed/backfill-artist-enrichment.ts` from Wikidata,
  // same "nullable, filled by a one-off script, never a required column"
  // pattern as `venues.lat`/`lng` — most artists won't have any of these.
  instagramUrl: text("instagram_url"),
  facebookUrl: text("facebook_url"),
  twitterUrl: text("twitter_url"),
  claimedByUserId: text("claimed_by_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Event ↔ Artist (many-to-many cast/company link) ----------
// One row per (event, artist) pairing — a show can list several artists, and an
// artist appears across many shows over time. Surrogate id, like `performances`
// (the other event-fan-out join table) — not a composite PK like `reactions`/
// `follows`/`comments`, which encode a *per-user* uniqueness that doesn't apply
// here. Unlike `performances` (whose dedup is app-side), the unique constraint
// below is enforced by the DB: there's no legitimate duplicate cast-credit row.

export const eventArtists = pgTable(
  "event_artists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("event_artists_event_artist_unique").on(t.eventId, t.artistId),
    index("event_artists_artist_id_idx").on(t.artistId),
  ],
);

// ============================================================================
// Ingestion (the worker's own namespace — kept separate from the product tables)
// ============================================================================
// The ingestion service OWNS these two tables. Its only write-contract into the
// product is the resolve step (source_events → events/venues/performances), so
// the whole ingestion path can be lifted into its own service/repo later without
// reshaping the canonical model. See docs + the plan for the data-boundary rationale.

// ---------- Source events (raw per-source staging / provenance layer) ----------
// One row per external record `(source, sourceRef)`. Holds the raw payload plus
// the fields we extract for mapping and (future) cross-source dedup. The resolve
// step reads these and writes back the canonical ids it produced. A single show's
// run yields many rows (each source "event" is really one dated showing), and a
// source may emit duplicate listings — both are collapsed at resolve time.

export const sourceEvents = pgTable(
  "source_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(), // 'ticketmaster' | 'theatre_info' | ...
    sourceRef: text("source_ref").notNull(), // the source's own id (TM event.id)
    sourceUrl: text("source_url"), // buy/detail link at the source (TM event.url)
    // Full upstream payload — lets us re-derive canonical fields, or let a better
    // source win a field later, without a re-pull.
    raw: jsonb("raw").notNull(),
    // Extracted fields for mapping + dedup (mirrors the Phase-A profiling shape).
    title: text("title"),
    venueName: text("venue_name"),
    venueAddress: text("venue_address"),
    city: text("city"),
    postalCode: text("postal_code"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    genre: text("genre"),
    subGenre: text("sub_genre"),
    imageUrl: text("image_url"),
    performers: text("performers").array(),
    // Normalised `title|venue|date` — the candidate cross-source match key.
    dedupKey: text("dedup_key"),
    // Resolution links — null until the resolve step maps this record.
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    venueId: uuid("venue_id").references(() => venues.id, { onDelete: "set null" }),
    performanceId: uuid("performance_id").references(() => performances.id, {
      onDelete: "set null",
    }),
    // Lifecycle: firstSeenAt is fixed on insert; lastSeenAt bumps every time the
    // record is re-seen in a pull → drives "still live" / staleness metrics.
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("source_events_source_ref_unique").on(t.source, t.sourceRef),
    index("source_events_dedup_key_idx").on(t.dedupKey),
    index("source_events_event_id_idx").on(t.eventId),
  ],
);

// ---------- Ingestion runs (run log + metrics history) ----------
// One row per orchestrated `all` run. Carries the request count (daily-budget
// visibility), per-stage upsert counts, and a metrics snapshot (jsonb) so the
// /dev/data-quality page can chart coverage over time without a separate store.

export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull().default("all"), // which source(s) this run covered
  status: text("status").notNull().default("running"), // running | success | error
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  requests: integer("requests").notNull().default(0), // API calls made (vs 5000/day)
  fetched: integer("fetched").notNull().default(0), // upstream events fetched
  sourceEventsUpserted: integer("source_events_upserted").notNull().default(0),
  eventsUpserted: integer("events_upserted").notNull().default(0),
  venuesUpserted: integer("venues_upserted").notNull().default(0),
  performancesUpserted: integer("performances_upserted").notNull().default(0),
  artistsUpserted: integer("artists_upserted").notNull().default(0),
  error: text("error"),
  metrics: jsonb("metrics"), // coverage snapshot at run end (see metrics.ts)
  // Per-source new/enhanced/modified/unchanged counts for this run (see
  // SourceBreakdown in apps/worker/src/lib/runs.ts) — the pull-level breakdown
  // the /dev/data-quality run history drills into, distinct from `metrics`
  // (which is a point-in-time catalogue-wide snapshot, not a per-run delta).
  sourceBreakdown: jsonb("source_breakdown"),
});

// ---------- Profiles (our user, layered on better-auth's `user`) ----------
// better-auth owns login/identity; this holds who you are *on Scenes*. One row
// is created when onboarding completes. `onboardedAt` set = onboarding done
// (used to gate the /onboarding redirect).

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  pseudo: text("pseudo").notNull().unique(),
  frequency: text("frequency"), // theatre-going cadence (rarely | yearly | monthly | weekly)
  favoriteGenres: text("favorite_genres").array().notNull(), // bounded set, read as a whole
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Reference likes (onboarding cold-start signal) ----------
// The past reference pieces a user flagged as loved — the strongest early taste
// signal. `referencePieceId` is a string key from lib/reference-pieces.ts for
// now; it becomes an FK to a real event once the catalogue is populated.

export const referenceLikes = pgTable(
  "reference_likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referencePieceId: text("reference_piece_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.referencePieceId] })],
);

// ---------- Reactions (Facebook-style emoji rating on a show) ----------
// One reaction per user per event — the composite PK enforces "single emoji".
// `kind` is validated in-app against apps/web/lib/reactions.ts (like | exceptional
// | funny | emotional). Reacts to the event (production), not a single showing.

export const reactions = pgTable(
  "reactions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);

// ---------- Attendance ("seen") ----------
// One row per (user, event) marking that the user attended the show. Set either
// by the explicit "Je l'ai vu" button or as a side effect of reacting. Powers
// the Mon Espace tab and, later, the community feed. Independent of `reactions`:
// un-reacting does not un-mark seen.

export const attendance = pgTable(
  "attendance",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);

// ---------- Follows (one-way social graph) ----------
// `followerId` follows `followeeId`. One-way (not mutual) — no accept step.
// Powers Ma communauté: the feed of comments from people you follow. Self-follow
// is rejected in-app. Mutual-accept can be layered on later without a reshape.

export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followeeId: text("followee_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followeeId] })],
);

// ---------- Venue / artist follows (one-way user → venue / user → artist) ----------
// Same shape as `follows`, duplicated per followable kind rather than made
// polymorphic: Postgres FKs can't target "users OR venues OR artists" with one
// column, and a (targetType, targetId) design would lose referential integrity.
// Feeds the future recommendation engine with supply-side signal.

export const venueFollows = pgTable(
  "venue_follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.venueId] })],
);

export const artistFollows = pgTable(
  "artist_follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.artistId] })],
);

// ---------- Comments (a user's review of a show) ----------
// One editable comment per (user, event) — the user's personal note/review,
// shown in Mon Espace and, later, to their followers in Ma communauté. Writing
// one implies attendance.

export const comments = pgTable(
  "comments",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);

// ---------- Dev notes (in-app feedback / idea capture) ----------
// The "dev mode" widget: founders drop bugs and feature ideas straight from the
// page they're on. Not user-facing — the widget only renders for allowlisted
// emails (DEV_FEEDBACK_EMAILS). Reviewed and triaged at /dev/notes, then moved
// into the real backlog. `category` and `status` are validated in-app
// (lib/dev-notes.ts). `userId` is nullable so a note survives if the author's
// account is later deleted.

export const devNotes = pgTable("dev_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  body: text("body").notNull(),
  category: text("category").notNull().default("idea"), // bug | idea | other
  path: text("path"), // page the note was dropped from (pathname + query)
  status: text("status").notNull().default("untackled"), // untackled | waiting_for_input | plan_done | implemented_pending_review | done
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Claims (venue/artist ownership claim requests) ----------
// A user asserts "this venue/artist page is mine". Goes into a queue Théo
// reviews by hand — manual verification only in v1, no email-domain
// auto-matching — mirroring `devNotes`'s shape: a status flipped by a human,
// no roles/permissions system. `targetId` can't be a typed FK since it spans
// two tables (`venues`, `artists`) depending on `targetType`; accepted because
// this table is low-volume and admin-only, and app code validates the
// reference at insert time. Reviewed at /dev/claims (see getDevAccess()).

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetType: text("target_type").notNull(), // 'venue' | 'artist'
    targetId: uuid("target_id").notNull(), // venues.id or artists.id, by targetType
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    message: text("message").notNull(), // free-text proof/context from the claimant
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    index("claims_target_idx").on(t.targetType, t.targetId),
    index("claims_status_idx").on(t.status),
  ],
);
