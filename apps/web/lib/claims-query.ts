import { eq } from "drizzle-orm";
import { artists, claims, user, venues } from "@scenes/db";
import { getDb } from "./db";

// Server-only read side of claims. Powers /dev/claims. `targetId` isn't a
// typed FK (it spans venues/artists depending on targetType — see schema.ts),
// so venue and artist claims are looked up separately, then merged.

export interface ClaimRow {
  id: string;
  targetType: "venue" | "artist";
  targetName: string;
  targetSlug: string | null;
  message: string;
  status: string;
  createdAt: Date;
  claimantName: string | null;
}

export async function getClaimsForTriage(): Promise<ClaimRow[]> {
  const db = getDb();

  const venueClaims = await db
    .select({
      id: claims.id,
      targetType: claims.targetType,
      message: claims.message,
      status: claims.status,
      createdAt: claims.createdAt,
      targetName: venues.name,
      targetSlug: venues.slug,
      claimantName: user.name,
      claimantEmail: user.email,
    })
    .from(claims)
    .innerJoin(venues, eq(claims.targetId, venues.id))
    .leftJoin(user, eq(claims.userId, user.id))
    .where(eq(claims.targetType, "venue"));

  const artistClaims = await db
    .select({
      id: claims.id,
      targetType: claims.targetType,
      message: claims.message,
      status: claims.status,
      createdAt: claims.createdAt,
      targetName: artists.name,
      targetSlug: artists.slug,
      claimantName: user.name,
      claimantEmail: user.email,
    })
    .from(claims)
    .innerJoin(artists, eq(claims.targetId, artists.id))
    .leftJoin(user, eq(claims.userId, user.id))
    .where(eq(claims.targetType, "artist"));

  return [...venueClaims, ...artistClaims]
    .map((r) => ({
      id: r.id,
      targetType: r.targetType as "venue" | "artist",
      targetName: r.targetName,
      targetSlug: r.targetSlug,
      message: r.message,
      status: r.status,
      createdAt: r.createdAt,
      claimantName: r.claimantName ?? r.claimantEmail ?? null,
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
