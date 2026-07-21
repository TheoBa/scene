import { pgTable, uuid, text, date, timestamp } from "drizzle-orm/pg-core";

// Lean POC schema — three logical domains in the public namespace: Venues,
// Events, Users. Kept deliberately concise; columns are added when a feature
// actually needs them (e.g. lat/lng once the map lands, provenance once
// automated ingestion returns). Artists are deferred.

// ---------- Venues ----------

export const venues = pgTable("venues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Events (a show/production; one representative date for now) ----------

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id").references(() => venues.id),
  name: text("name").notNull(),
  date: date("date"),
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
