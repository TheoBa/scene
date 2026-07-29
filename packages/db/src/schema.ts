import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";

// Lean POC schema — logical domains in the public namespace: Venues, Events,
// Performances. Kept concise; columns are added when a feature needs them
// (e.g. lat/lng once the map lands, provenance once ingestion returns).
// Artists are deferred.

// ---------- Venues ----------

export const venues = pgTable("venues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  address: text("address"),
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
  status: text("status").notNull().default("new"), // new | processed
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
