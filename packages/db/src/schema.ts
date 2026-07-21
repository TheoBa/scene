import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  boolean,
  date,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------- Catalogue (fed by the worker's daily ingestion) ----------

export const venues = pgTable("venues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  address: text("address"),
  city: text("city").notNull().default("Paris"),
  lat: real("lat"),
  lng: real("lng"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pieces = pgTable(
  "pieces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    synopsis: text("synopsis"),
    venueId: uuid("venue_id").references(() => venues.id),
    startDate: date("start_date"),
    endDate: date("end_date"),
    imageUrl: text("image_url"),
    // Provenance — which feed this record came from (dedup/entity resolution)
    source: text("source"), // 'openagenda' | 'datatourisme' | 'francebillet' | 'ticketmaster' | 'venue' | 'manual'
    sourceRef: text("source_ref"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pieces_source_ref_idx").on(t.source, t.sourceRef)],
);

export const artists = pgTable("artists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  bio: text("bio"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pieceArtists = pgTable(
  "piece_artists",
  {
    pieceId: uuid("piece_id")
      .notNull()
      .references(() => pieces.id),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id),
    role: text("role"), // 'comedien' | 'metteur_en_scene' | 'auteur' | ...
  },
  (t) => [primaryKey({ columns: [t.pieceId, t.artistId] })],
);

export const ticketingOffers = pgTable("ticketing_offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  pieceId: uuid("piece_id")
    .notNull()
    .references(() => pieces.id),
  partner: text("partner").notNull(), // 'francebillet' | 'ticketmaster' | 'fever' | ...
  url: text("url").notNull(),
  affiliateUrl: text("affiliate_url"),
  priceFrom: integer("price_from_cents"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Social (better-auth owns its own user/session tables; profiles extends it) ----------

export const profiles = pgTable("profiles", {
  // matches better-auth user id
  userId: text("user_id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  isArtist: boolean("is_artist").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => profiles.userId),
    followedId: text("followed_id")
      .notNull()
      .references(() => profiles.userId),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followedId] })],
);

export const ratings = pgTable(
  "ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.userId),
    pieceId: uuid("piece_id")
      .notNull()
      .references(() => pieces.id),
    rating: integer("rating").notNull(), // 1..5
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ratings_user_piece_idx").on(t.userId, t.pieceId)],
);

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.userId),
  pieceId: uuid("piece_id")
    .notNull()
    .references(() => pieces.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
