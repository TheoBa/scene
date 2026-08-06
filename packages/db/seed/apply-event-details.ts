// One-off: applies a patch file of agent-extracted event details (poster,
// author, director, cast, duration) to `events`/`event_artists`. This is
// the write half of an agent-assisted bootstrap, not an automated scraper —
// there is no LLM API call anywhere in this repo for it. The candidates
// (list-event-detail-candidates.ts) and the actual page-reading/extraction
// are done by Claude Code itself (fetching venue sites / theatre.info /
// billetreduc, reading pages, extracting fields) as part of an interactive
// session, using Théo's Claude subscription rather than a separate metered
// API key. See docs/scenes-knowledge-base.md §13 decision log (2026-08-06)
// for the sourcing rationale, including the narrow billetreduc override.
//
// Patch file shape (JSON array), one entry per event the agent extracted
// something for:
//   [{
//     eventId: string,
//     posterImageUrl: string | null,
//     author: string | null,
//     director: string | null,
//     castMembers: string[],
//     durationMinutes: number | null,
//     sourceLabel: "venue-site" | "theatre-info" | "billetreduc",
//     sourceUrl: string,       // the exact page the agent read
//   }, ...]
//
// Only fills currently-NULL fields, never overwrites — same convention as
// every other backfill script here. Before writing, re-fetches `sourceUrl`
// itself (plain fetch, no LLM) and drops posterImageUrl/castMembers entries
// that don't literally appear on that page — a cheap safety net independent
// of the agent's own care during extraction. If the re-fetch itself fails
// (page moved, network blip), the agent-extracted values are kept as-is
// and a warning is logged, rather than discarding real data over a
// transient fetch failure.
//
//   npm run apply-event-details -w packages/db -- --dry-run --patch-file=patch.json
//   npm run apply-event-details -w packages/db -- --patch-file=patch.json
// Needs DATABASE_URL.
import { eq } from "drizzle-orm";
import { artists, createDb, eventArtists, events, slugify, uniqueSlug, type Db } from "../src/index.js";

const USER_AGENT = "ScenesBot/1.0 (https://scenes.badoz.org; one-off event-detail backfill, agent-assisted)";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_CHARS = 200_000;

const DRY_RUN = process.argv.includes("--dry-run");
function argValue(flag: string): string | undefined {
  const prefix = `--${flag}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}
const PATCH_FILE = argValue("patch-file");

interface PatchEntry {
  eventId: string;
  posterImageUrl: string | null;
  author: string | null;
  director: string | null;
  castMembers: string[];
  durationMinutes: number | null;
  sourceLabel: "venue-site" | "theatre-info" | "billetreduc";
  sourceUrl: string;
}

function normalizeForSubstring(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function containsLiteral(haystack: string, needle: string): boolean {
  if (!needle.trim()) return false;
  return normalizeForSubstring(haystack).includes(normalizeForSubstring(needle));
}

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: controller.signal });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text")) return null;
    const html = await res.text();
    return html.length > MAX_HTML_CHARS ? html.slice(0, MAX_HTML_CHARS) : html;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Same upsert-by-name pattern as seed/index.ts / apps/worker/src/enrich.ts,
// inlined since this script isn't shaped around sourceEvents rows.
async function upsertAndLinkArtists(db: Db, eventId: string, names: string[]): Promise<{ created: number; linked: number }> {
  const trimmed = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (trimmed.length === 0) return { created: 0, linked: 0 };

  const existingArtists = await db.select({ id: artists.id, name: artists.name, slug: artists.slug }).from(artists);
  const takenSlugs = new Set(existingArtists.map((a) => a.slug));
  const idByName = new Map(existingArtists.map((a) => [a.name, a.id]));

  const newNames = trimmed.filter((n) => !idByName.has(n));
  let created = 0;
  if (newNames.length) {
    const inserted = await db
      .insert(artists)
      .values(
        newNames.map((name) => {
          const slug = uniqueSlug(slugify(name), takenSlugs);
          takenSlugs.add(slug);
          return { name, slug };
        }),
      )
      .onConflictDoNothing()
      .returning({ id: artists.id, name: artists.name });
    created = inserted.length;
    for (const a of inserted) idByName.set(a.name, a.id);
  }

  const pairs = trimmed
    .map((name) => idByName.get(name))
    .filter((id): id is string => Boolean(id))
    .map((artistId) => ({ eventId, artistId }));

  let linked = 0;
  if (pairs.length) {
    const insertedLinks = await db.insert(eventArtists).values(pairs).onConflictDoNothing().returning({ id: eventArtists.id });
    linked = insertedLinks.length;
  }
  return { created, linked };
}

async function main(): Promise<void> {
  if (!PATCH_FILE) throw new Error("--patch-file=<path> is required");
  console.log(`[apply-event-details] ${DRY_RUN ? "DRY RUN — no writes will be made" : "no --dry-run: WILL WRITE to the database"}, patch-file=${PATCH_FILE}\n`);

  const fs = await import("node:fs/promises");
  const raw = await fs.readFile(PATCH_FILE, "utf-8");
  const patch: PatchEntry[] = JSON.parse(raw);

  const db = createDb();
  let enriched = 0;
  let artistsCreated = 0;
  let artistsLinked = 0;
  const fieldFillCounts = { imageUrl: 0, author: 0, director: 0, durationMinutes: 0, cast: 0 };

  for (const entry of patch) {
    const [current] = await db
      .select({
        imageUrl: events.imageUrl,
        author: events.author,
        director: events.director,
        durationMinutes: events.durationMinutes,
        name: events.name,
      })
      .from(events)
      .where(eq(events.id, entry.eventId));
    if (!current) {
      console.warn(`[apply-event-details] event ${entry.eventId} not found, skipping`);
      continue;
    }

    const sourceHtml = await fetchPage(entry.sourceUrl);
    let posterImageUrl = entry.posterImageUrl;
    let castMembers = entry.castMembers;
    if (sourceHtml) {
      posterImageUrl = posterImageUrl && containsLiteral(sourceHtml, posterImageUrl) ? posterImageUrl : null;
      castMembers = castMembers.filter((name) => containsLiteral(sourceHtml, name));
    } else {
      console.warn(`[apply-event-details] "${current.name}" — could not re-fetch ${entry.sourceUrl} to verify, trusting agent extraction as-is`);
    }

    const patchFields: { imageUrl?: string; imageSource?: string; author?: string; director?: string; durationMinutes?: number } = {};
    const filled: string[] = [];
    if (current.imageUrl === null && posterImageUrl) {
      patchFields.imageUrl = posterImageUrl;
      patchFields.imageSource = entry.sourceLabel;
      filled.push("imageUrl");
      fieldFillCounts.imageUrl++;
    }
    if (current.author === null && entry.author) {
      patchFields.author = entry.author;
      filled.push("author");
      fieldFillCounts.author++;
    }
    if (current.director === null && entry.director) {
      patchFields.director = entry.director;
      filled.push("director");
      fieldFillCounts.director++;
    }
    if (current.durationMinutes === null && entry.durationMinutes) {
      patchFields.durationMinutes = Math.round(entry.durationMinutes);
      filled.push("durationMinutes");
      fieldFillCounts.durationMinutes++;
    }

    const namesToLink = [...castMembers];
    if (patchFields.author) namesToLink.push(patchFields.author);
    if (patchFields.director) namesToLink.push(patchFields.director);

    if (Object.keys(patchFields).length === 0 && namesToLink.length === 0) {
      console.log(`[NO-OP] "${current.name}" (${entry.sourceLabel}) — nothing new to apply`);
      continue;
    }

    console.log(
      `[${DRY_RUN ? "WOULD ENRICH" : "ENRICHED"}] "${current.name}" (${entry.sourceLabel}) — fields: ${filled.join(", ") || "none"}, cast: ${namesToLink.join(", ") || "none"}`,
    );
    if (!DRY_RUN) {
      if (Object.keys(patchFields).length > 0) await db.update(events).set(patchFields).where(eq(events.id, entry.eventId));
      if (namesToLink.length > 0) {
        const { created, linked } = await upsertAndLinkArtists(db, entry.eventId, namesToLink);
        artistsCreated += created;
        artistsLinked += linked;
        fieldFillCounts.cast += linked;
      }
    }
    enriched++;
  }

  console.log(`\n[apply-event-details] done — ${enriched} enriched of ${patch.length} patch entries`);
  console.log(
    `[apply-event-details] field fills — imageUrl: ${fieldFillCounts.imageUrl}, author: ${fieldFillCounts.author}, director: ${fieldFillCounts.director}, durationMinutes: ${fieldFillCounts.durationMinutes}, cast links: ${fieldFillCounts.cast} (artists created: ${artistsCreated})`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[apply-event-details] failed:", err);
    process.exit(1);
  });
