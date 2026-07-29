# Ingestion source — Ticketmaster Discovery API

Knowledge base for evaluating and building an ingestion path against the
**Ticketmaster Discovery API v2** to pull cultural events in Paris. Companion to
`ingestion_worker.md` (theatre.info) — same purpose: give a freshly-spawned agent
a strong base. Sister docs: `technical-roadmap.md`, `scenes-knowledge-base.md`
(data-sourcing & legal strategy, decision log).

> **Status (2026-07-29):** Key obtained and smoke-tested against live Paris data.
> Auth confirmed (see §3). Response shape confirmed for event search (§4.3). Ready
> to build the Phase-A pull. This doc also records the **licensing catch** that
> makes TM a different kind of source from theatre.info.

> **Decision (2026-07-28):** Ticketmaster is a **throwaway kickstart, not a
> long-term source.** Its purpose is to seed an initial Paris catalogue so we can
> **apply for the Awin / France Billet affiliate partnership** — a chicken-and-egg
> problem, since approval typically needs a live catalogue to point at. We expect
> to **drop it by launch**, once theatre.info (canonical, open) and the Awin feed
> (revenue) are in place. This deliberately sidesteps the §2 "store forever" ToS
> concern: we're bootstrapping, not building a permanent mirror. See the decision
> log in `scenes-knowledge-base.md`.

---

## 1. TL;DR — is this a good fit?

Ticketmaster Discovery is a large, well-documented, reliable events API with real
Paris coverage and, crucially, **ticketing/affiliate URLs baked in** — which maps
directly onto our revenue model. **But its data is _not_ open**: use is governed
by Ticketmaster's Terms of Service + branding guide, not a reuse-friendly licence
like theatre.info's Etalab. Practically, that means: attribution/branding is
mandatory, you generally must link buyers back to Ticketmaster, long-term caching
/ redistribution is restricted, and you can't present it as a competing catalogue.

**Recommendation to weigh with Théo:** treat Ticketmaster as a **ticketing /
buy-link + discovery-signal source layered on top of a canonical catalogue**
(theatre.info), *not* as the catalogue of record. See §7. Also note the heavy
overlap with our existing **France Billet** source (§6) — Ticketmaster acquired a
majority of France Billet (Fnac Spectacles); the inventories substantially
overlap, so we should not double-count.

---

## 2. Licensing & terms — the important part

Unlike theatre.info (Licence Ouverte / Etalab, commercial reuse OK), Ticketmaster
data is **proprietary**, licensed only under:

- the **Ticketmaster Developer Terms of Service**, and
- the **Ticketmaster Branding & API Attribution guide**.

What that implies (confirm exact current wording in the ToS before we commit —
**(to confirm)**):

- **Attribution / branding is mandatory** — logo/wordmark placement and
  "Powered by Ticketmaster" style attribution per the branding guide.
- **Traffic must flow back to Ticketmaster** — events are expected to link to the
  Ticketmaster purchase URL (`event.url`); you may not strip the buy path or
  substitute a competitor's checkout.
- **Caching / redistribution is limited** — you can query and display, but
  building a permanent independent mirror of their catalogue is typically not
  permitted. This clashes with a "pull nightly, store forever, dedup into our own
  events table" model — so our provenance/refresh design must respect it.
- **No warranty; can revoke.** Free tier can be rate-limited or cut.

**The rate-limit-increase gate doubles as a compliance gate.** To raise quota
above the default, Ticketmaster verifies three things: (1) compliance with the
Terms of Service, (2) proper representation of Ticketmaster data, (3) adherence to
the branding guide. Only then is the limit "increased to what Ticketmaster and the
developer determine to be appropriate."

→ **Decision-log item:** confirm whether our intended use (aggregating into our
own catalogue with affiliate links) is permitted, or whether Ticketmaster must
stay a display-time/link-out source only. Do **not** design a "store forever"
pipeline before this is answered.

---

## 3. Access & authentication

- **Register an app** to get a key:
  `https://developer-acct.ticketmaster.com/user/register` (create a developer
  account, register an application → receive a **Consumer Key** and a **Consumer
  Secret**).
- **Auth mechanism (confirmed 2026-07-29):** a query parameter on every request —
  **`apikey=<Consumer Key>`**. No OAuth, no header. The **Consumer Secret is NOT
  used** by Discovery v2 (it's only for OAuth-based TM products we don't touch) —
  keep it out of the repo. Example:
  `https://app.ticketmaster.com/discovery/v2/events.json?apikey=<key>`
- **Stored as** `TICKETMASTER_API_KEY` in the gitignored root `.env`
  (placeholder already in `.env.example`); code reads `process.env` /
  `os.environ`.
- **Rate limits (default tier):**
  - **5 requests per second**
  - **5000 API calls per day**
- **Deep-paging cap:** you can only retrieve up to the **1000th item** — i.e.
  `page * size` must stay `< 1000`. To sweep a larger result set you must
  **partition the query** (by date window, city, classification, geo) so each
  slice returns < 1000 items. This is the single biggest structural constraint
  for a bulk Paris pull.
- **Quota increase:** request via Ticketmaster, gated on the three compliance
  criteria in §2.

---

## 4. API reference

**Base URL**

```
https://app.ticketmaster.com/discovery/v2/
```

**Response format:** JSON in **HAL** style — collections under `_embedded`, paging
under `page`, navigation under `_links`.

### 4.1 Endpoints

| Purpose | Path |
|---|---|
| Event search | `/discovery/v2/events.json` |
| Event details | `/discovery/v2/events/{id}.json` |
| Attraction search | `/discovery/v2/attractions.json` |
| Attraction details | `/discovery/v2/attractions/{id}.json` |
| Venue search | `/discovery/v2/venues.json` |
| Venue details | `/discovery/v2/venues/{id}.json` |
| Classifications | `/discovery/v2/classifications.json` |
| Segment details | `/discovery/v2/classifications/segments/{id}` |

**Classification** is a 3-level tree: **Segment** → **Genre** → **Sub-genre**.
Segments are: Music, Sports, **Arts & Theatre**, Film, Family, Miscellaneous.
For Scenes, **Arts & Theatre** is the segment of interest. Its well-known
segmentId is **`KZFzniwnSyZfZ7v7na`** _(to confirm via the classifications
endpoint — always resolve ids live rather than hard-coding blindly)_.

### 4.2 Key event-search parameters

Passed as query params on `events.json`. Most-relevant for a Paris cultural pull:

| Param | Meaning |
|---|---|
| `apikey` | API key (required) |
| `keyword` | free-text search |
| `city` | city name, e.g. `Paris` (repeatable) |
| `countryCode` | ISO 3166 alpha-2, e.g. **`FR`** |
| `stateCode` | state/region code |
| `postalCode` | postal code |
| `latlong` | `lat,long` centre point (deprecated in favour of `geoPoint`) |
| `geoPoint` | geohash centre for radius search |
| `radius` + `unit` | radius; `unit` = `miles` \| `km` |
| `classificationName` | human name, e.g. `Theatre`, `Arts & Theatre` |
| `classificationId` / `segmentId` / `genreId` / `subGenreId` | id-based classification filter |
| `startDateTime` / `endDateTime` | event date window, ISO-8601 UTC `YYYY-MM-DDTHH:mm:ssZ` |
| `onsaleStartDateTime` / `onsaleEndDateTime` | ticket on-sale window |
| `size` | page size (default 20; **max 200**, but bounded by the 1000-item deep-paging cap) |
| `page` | 0-based page index |
| `sort` | e.g. `date,asc`, `relevance,desc`, `distance,asc`, `name,asc` |
| `locale` | e.g. `fr`, `en`, `*` (all); use `fr` / `*` for French listings |
| `source` | `ticketmaster` \| `universe` \| `frontgate` \| `tmr` (comma-sep) |
| `includeTBA` / `includeTBD` | include to-be-announced / to-be-determined dates (`yes`/`no`/`only`) |
| `includeTest` | include test events (`no` in prod) |
| `marketId` / `dmaId` | market / designated-market-area filter |

### 4.3 Response shape (event search)

```
{
  "_embedded": { "events": [ { ... } ] },
  "_links":    { "first": {...}, "self": {...}, "next": {...}, "last": {...} },
  "page":      { "size": 20, "totalElements": N, "totalPages": M, "number": 0 }
}
```

Fields confirmed present on a live event object (2026-07-29 smoke test):
`name`, `type` (`"event"`), `id`, `test` (bool), `description`, plus the fields
below (standard Discovery event shape — exact nesting to re-verify per field as we
map):
- `id`, `name`, `url` (the **Ticketmaster purchase URL** — our affiliate/buy link),
- `dates.start.dateTime` / `localDate` / `localTime` → `performances.startsAt`,
- `classifications[]` (segment/genre) → tags **and the noise filter, see §4.5**,
- `_embedded.venues[]` → `venues` (`name`, `city.name`, `address.line1`,
  `location.latitude/longitude`),
- `_embedded.attractions[]` → performers/company → `author`/`director`,
- `images[]` → `events.imageUrl`,
- `priceRanges[]`, `sales` → future ticketing metadata.

### 4.5 The "Arts & Theatre" segment is noisy — filter by genre

Confirmed live: `classificationName=Arts & Theatre` returned
`CITE DES ENFANTS 2-6 ANS` (a kids' science-museum attraction) as its top Paris
result. The **segment bundles genres we don't want** (Family, Museum/Attraction,
Comedy, Dance, etc.). So for a clean theatre catalogue:
- filter to the **Theatre genre**, not just the segment — resolve its `genreId`
  live via `/discovery/v2/classifications.json` (or `classificationName=Theatre`),
  and _(to confirm)_ pin the exact genreId; and/or
- constrain by a **Paris theatre-venue whitelist** (we already maintain a
  ~200-theatre list — see the venues-sheet memory) via `venueId`, which is the
  most precise filter and also solves dedup against theatre.info.
- Expect to still hand-review edge cases; TM's classification is coarse.

### 4.4 Example requests

```
# Paris cultural events, arts & theatre, next 30 days, French locale
https://app.ticketmaster.com/discovery/v2/events.json
  ?apikey=<key>
  &city=Paris&countryCode=FR
  &classificationName=Arts%20%26%20Theatre
  &locale=fr
  &startDateTime=2026-08-01T00:00:00Z&endDateTime=2026-08-31T23:59:59Z
  &size=200&page=0&sort=date,asc

# Radius search around central Paris
https://app.ticketmaster.com/discovery/v2/events.json
  ?apikey=<key>&latlong=48.8566,2.3522&radius=20&unit=km
  &segmentId=KZFzniwnSyZfZ7v7na&size=200

# Resolve the Arts & Theatre segment id
https://app.ticketmaster.com/discovery/v2/classifications.json?apikey=<key>
```

---

## 5. Querying "cultural events in Paris" — strategy

The user's first goal: get a list of cultural events in Paris. Concretely:

1. **Scope filter:** `countryCode=FR` + `city=Paris` (and/or `latlong` +
   `radius=~20km` to catch inner-suburb venues), `classificationName=Arts &
   Theatre` (segment) — optionally widen to Music/Family if "cultural" is broader
   than strict theatre. `locale=fr`.
2. **Beat the 1000-item deep-paging cap:** don't page one giant query past item
   1000. **Partition by date window** (e.g. rolling weekly/monthly
   `startDateTime`→`endDateTime` slices) and, if a slice still exceeds 1000, also
   split by genre/subGenre. Each slice: page `size=200` from `page=0` until
   `page.number == page.totalPages-1` (respecting `page*size < 1000`).
3. **Respect limits:** ≤ 5 req/s, ≤ 5000 calls/day. A partitioned Paris sweep is
   well within 5000/day; add client-side throttling anyway.
4. **Persist provenance + the `event.url`** buy link, honouring §2 branding/ToS.

Phase-A manual exploration (mirroring the theatre.info plan): a small script that
does the partitioned pull to local JSON, then PySpark to profile fields, measure
volume, and find dedup keys (title + venue + date) — including cross-matching
against **France Billet** rows to avoid double-counting (§6).

---

## 6. Overlap with France Billet (existing source)

We already have an ingestion stub for **France Billet** (`apps/worker/src/sources/
francebillet.ts`, via the Awin XML feed). Ticketmaster **owns a majority of
France Billet / Fnac Spectacles**, so a large share of Ticketmaster-FR inventory
*is* France Billet inventory under a different wrapper. Implications:

- Don't treat them as independent sources — **dedup across them**, or pick one as
  the ticketing source for a given event.
- The Awin/France Billet feed may already carry the **affiliate commission**
  relationship we want; the Ticketmaster Discovery API gives richer structured
  metadata but its `url` may not be an Awin-attributed affiliate link. **Open
  question:** which path actually earns us commission on a Paris theatre ticket?
  That likely decides whether we ingest Ticketmaster at all, versus leaning on the
  France Billet Awin feed for the same events.

---

## 7. How it fits the worker (if we proceed)

Same pattern as the other sources: a module
`apps/worker/src/sources/ticketmaster.ts` exporting
`ingestTicketmaster(db): Promise<{ upserted: number }>`, wired into
`runIngestion()` in `apps/worker/src/index.ts` (daily 05:00 Europe/Paris,
`Promise.allSettled`). Upsert keyed on `(source, sourceRef)` with
`sourceRef = event.id`. Map: event → `events`, `_embedded.venues[]` → `venues`,
`dates.start` → `performances`, `event.url` → `events.officialUrl` / a future
`ticketUrl`. Record provenance for attribution.

But **role clarity first** (see §1/§2): most likely Ticketmaster is a *ticketing
enrichment* on events already sourced from theatre.info — supplying the buy link
and freshness signal — rather than a primary catalogue we mirror. Settle that with
Théo before building.

---

## 8. Open decisions for Théo

- **Licence/ToS fit:** does Ticketmaster's ToS permit aggregating into our own
  catalogue, or must it be link-out/display-time only? (Blocking.)
- **Affiliate path:** does the Ticketmaster `event.url` earn commission, or is the
  **France Billet Awin** feed the real revenue path for the same Paris events? If
  the latter, Ticketmaster Discovery may be redundant.
- **Source role:** canonical catalogue vs. ticketing/discovery enrichment on top
  of theatre.info.
- **"Cultural" scope:** Arts & Theatre only, or broader (Music, Family)?

## Sources

- [Discovery API v2](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)
- [Discovery API v2 manual (parameters & responses)](https://developer.ticketmaster.com/products-and-docs/apis/discovery-manual/v2/)
- [Getting started (keys, rate limits)](https://developer.ticketmaster.com/products-and-docs/apis/getting-started/)
- [Events search tutorial](https://developer.ticketmaster.com/products-and-docs/tutorials/events-search/search_events_with_discovery_api.html)
- [Register a developer account](https://developer-acct.ticketmaster.com/user/register)
