// One-off: lists upcoming events still missing imageUrl/author/director/
// durationMinutes or cast, for the agent-assisted bootstrap described in
// apply-event-details.ts. Pure read — no writes, no external calls.
//   npm run list-event-detail-candidates -w packages/db -- --days-ahead=60 --limit=20
// Needs DATABASE_URL. Prints JSON to stdout (pipe to a file if needed).
import { sql } from "drizzle-orm";
import { createDb, type Db } from "../src/index.js";

function argValue(flag: string): string | undefined {
  const prefix = `--${flag}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}
const DAYS_AHEAD = Number(argValue("days-ahead") ?? "60");
const LIMIT = argValue("limit") !== undefined ? Number(argValue("limit")) : undefined;

export interface CandidateRow {
  eventId: string;
  eventName: string;
  eventSlug: string;
  author: string | null;
  director: string | null;
  durationMinutes: number | null;
  imageUrl: string | null;
  venueId: string;
  venueName: string;
  venueOfficialUrl: string | null;
  startsAt: string;
  noCast: boolean;
}

// Soonest upcoming performance per event within the window, joined to that
// performance's venue, plus whether the event already has any linked cast.
export async function loadCandidates(db: Db, daysAhead: number): Promise<CandidateRow[]> {
  const result = await db.execute(sql`
    with soonest as (
      select distinct on (p.event_id)
        e.id as "eventId",
        e.name as "eventName",
        e.slug as "eventSlug",
        e.author as "author",
        e.director as "director",
        e.duration_minutes as "durationMinutes",
        e.image_url as "imageUrl",
        v.id as "venueId",
        v.name as "venueName",
        v.official_url as "venueOfficialUrl",
        p.starts_at as "startsAt"
      from events e
      join performances p on p.event_id = e.id
      join venues v on v.id = p.venue_id
      where p.starts_at between now() and now() + make_interval(days => ${daysAhead})
      order by p.event_id, p.starts_at asc
    )
    select s.*,
      not exists (select 1 from event_artists ea where ea.event_id = s."eventId") as "noCast"
    from soonest s
    order by s."startsAt" asc
  `);
  return result.rows as unknown as CandidateRow[];
}

export function needsWork(row: CandidateRow): boolean {
  return row.imageUrl === null || row.author === null || row.director === null || row.durationMinutes === null || row.noCast;
}

async function main(): Promise<void> {
  const db = createDb();
  const all = (await loadCandidates(db, DAYS_AHEAD)).filter(needsWork);
  const selected = LIMIT !== undefined ? all.slice(0, LIMIT) : all;
  console.log(JSON.stringify(selected, null, 2));
  console.error(`[list-event-detail-candidates] ${selected.length} of ${all.length} eligible events (days-ahead=${DAYS_AHEAD})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[list-event-detail-candidates] failed:", err);
    process.exit(1);
  });
