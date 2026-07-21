import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

// Lean POC schema — logical domains in the public namespace: Venues, Events,
// Performances, Users. Kept concise; columns are added when a feature needs
// them (e.g. lat/lng once the map lands, provenance once ingestion returns).
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

// ---------- Users ----------
// Standalone for the POC. When better-auth lands it owns the auth identity
// (email/sessions) and `pseudo` becomes the public handle layered on top.

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  pseudo: text("pseudo").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
