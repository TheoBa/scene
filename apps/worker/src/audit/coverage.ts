/**
 * Coverage audit — answers the key Phase-1 unknown: does open data actually
 * cover Paris theatre? Fetches OpenAgenda, matches its events against a manual
 * reference list of known shows, and prints matched / missing counts.
 *
 * Read-only: no DB writes, no migrations needed. Run it before trusting the
 * ingester as the catalogue's backbone.
 *
 * Usage:
 *   npm run audit:coverage -w apps/worker
 *   REFERENCE=/path/to/list.json npm run audit:coverage -w apps/worker
 *
 * Reference file: JSON array of { "title": string, "venue"?: string }.
 * The bundled sample is a placeholder — replace it with a real reference list
 * (e.g. exported from the V0 billetreduc catalogue) to get a meaningful number.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fetchOpenAgendaEvents } from "../sources/openagenda.js";
import { normalizeText } from "../lib/text.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REFERENCE = path.join(
  __dirname,
  "reference-paris-theatre.sample.json",
);

interface ReferenceItem {
  title: string;
  venue?: string;
}

async function loadReference(file: string): Promise<ReferenceItem[]> {
  const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`${file}: expected a JSON array of { title, venue? }`);
  }
  return parsed as ReferenceItem[];
}

/** Covered if a fetched title normalizes equal, or either normalized title
 *  contains the other (tolerates subtitle drift like "Hamlet — d'après…"). */
function isCovered(
  ref: ReferenceItem,
  index: Set<string>,
  fetchedTitles: string[],
): boolean {
  const nref = normalizeText(ref.title);
  if (!nref) return false;
  if (index.has(nref)) return true;
  return fetchedTitles.some((t) => t.includes(nref) || nref.includes(t));
}

async function main(): Promise<void> {
  const referenceFile = process.env.REFERENCE ?? DEFAULT_REFERENCE;
  const reference = await loadReference(referenceFile);
  console.log(
    `[audit] reference: ${referenceFile} (${reference.length} shows)`,
  );

  const fetched = await fetchOpenAgendaEvents();
  console.log(`[audit] OpenAgenda returned ${fetched.length} events`);
  if (fetched.length === 0) {
    console.log(
      "[audit] Nothing fetched. Set OPENAGENDA_API_KEY and OPENAGENDA_AGENDA_UIDS, then re-run.",
    );
    return;
  }

  const fetchedTitles = fetched.map((p) => normalizeText(p.title));
  const index = new Set(fetchedTitles);

  const missing: ReferenceItem[] = [];
  let coveredCount = 0;
  for (const ref of reference) {
    if (isCovered(ref, index, fetchedTitles)) coveredCount++;
    else missing.push(ref);
  }

  const pct = reference.length
    ? Math.round((coveredCount / reference.length) * 100)
    : 0;
  console.log(`\n[audit] Coverage: ${coveredCount}/${reference.length} (${pct}%)`);
  if (missing.length > 0) {
    console.log("\n[audit] Missing from OpenAgenda:");
    for (const m of missing) {
      console.log(`  - ${m.title}${m.venue ? ` — ${m.venue}` : ""}`);
    }
  }
}

main().catch((err) => {
  console.error("[audit] failed:", err);
  process.exit(1);
});
