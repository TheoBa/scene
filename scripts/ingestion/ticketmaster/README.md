# Ticketmaster Discovery — Phase-A pull & profiling

Throwaway kickstart tooling to seed a Paris cultural-events catalogue from the
Ticketmaster Discovery API, so we can apply for the Awin / France Billet affiliate
partnership. Full context and the licensing caveat: `docs/ingestion_ticketmaster.md`.

**This is exploration, not the worker.** It lives outside `apps/worker` on purpose;
once the field map and dedup keys are settled we fold the learnings into
`apps/worker/src/sources/ticketmaster.ts`.

## Prerequisites

- Python 3.10+ and, for profiling, a **JVM (Java 11 or 17)** — PySpark needs it.
  Check with `java -version`; on macOS install with `brew install openjdk@17`.
- Your Ticketmaster **Consumer Key** in the repo-root `.env` as
  `TICKETMASTER_API_KEY=...` (already listed in `.env.example`). The Consumer
  Secret is not used.

## Setup (run in this directory)

```
theobadoz@Mac ticketmaster % python3 -m venv .venv
theobadoz@Mac ticketmaster % source .venv/bin/activate
theobadoz@Mac ticketmaster % pip install -r requirements.txt
```

`.venv/` is covered by the repo's root `.gitignore`.

## 1. Pull raw JSON

```
theobadoz@Mac ticketmaster % python pull.py
```

Defaults: Paris, `countryCode=FR`, and the **theatre `genreId` set** (Théâtre,
Théâtre pour enfants, Théâtre - Divers, Humour, Marionettes — dodging the noisy
`Culturel`/museum genre), today → +90 days in 7-day windows. Raw responses land in
`raw/` (gitignored), one file per API page. Any window exceeding the 1000-item
deep-paging cap is **auto-bisected** until each slice fits — no misses, no tuning.

Useful flags:

```
--start 2026-08-01 --end 2026-12-31   # sweep window
--window-days 3                        # smaller starting windows (bisection handles the rest)
--genre-ids KnvZfZ7v7l1,KnvZfZ7v7na    # Théâtre + enfants only (drop café-théâtre)
--genre-ids ""                          # no genre filter (whole segment — noisy)
--venue-ids KovZ917A...,KovZ...         # most precise: pull only these TM venues
```

See `docs/ingestion_ticketmaster.md` §4.5 for the genreId table.

**Success:** per-window lines like `2026-08-01→2026-08-08: 539 events`, `... > cap
— splitting` for dense weeks, and a final `Done. N event rows ...`. A `⚠ ...
1-day floor` line (rare) means a single day still exceeded the cap — tighten
`--genre-ids`/`--venue-ids` for that period.

## 2. Profile with PySpark

```
theobadoz@Mac ticketmaster % python profile_spark.py
```

Prints: distinct event count, schema, the **classification breakdown** (to see how
much non-theatre noise the filter still lets through), events-per-venue, date
coverage, candidate **dedup-key collisions** (title|venue|date), and per-field
null coverage. Use this to finalise the theatre.info-vs-TM dedup strategy and the
`events`/`venues`/`performances` field mapping before writing the worker source.

## Guardrails

- Never commit `raw/` or the API key.
- Respect the limits the pull already throttles for: 5 req/s, 5000 calls/day.
- Remember this source is a bootstrap — see the decision log in
  `docs/scenes-knowledge-base.md`.
