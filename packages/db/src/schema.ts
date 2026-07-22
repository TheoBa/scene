import { pgTable, uuid, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
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
