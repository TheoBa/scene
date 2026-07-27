# Ingestion worker — theatre.info source

Knowledge base for building the Scenes catalogue-ingestion worker against
**theatre.info**. Written so a freshly-spawned agent can pick up the work without
re-researching. Sister docs: `technical-roadmap.md` (where ingestion sits in the
plan), `scenes-knowledge-base.md` (data-sourcing & legal strategy, decision log).

> **Status (2026-07-27):** Planning / pre-build. API key **requested** as a
> partner, not yet granted (can take days). The goal now is to plan and build as
> much as possible so we can ingest the moment we get a positive answer. No live
> calls have been made yet — every field-level detail marked _(to confirm)_ must
> be verified against a real response before we trust it.

---

## 1. What theatre.info is

A participative, interprofessional French/European platform cataloguing live
**theatrical productions** (spectacles) and the **published texts** they stage,
currently on the bill across venues (structures), with the people (personnes)
and dates attached. Backed by the Centre National du Livre (CNL).

Why it fits Scenes: it is a curated, structured, **openly-licensed** catalogue of
exactly our domain (live theatre, Paris included), which the other sources
(OpenAgenda, DATAtourisme, France Billet) only cover incidentally. It is a strong
candidate to become a **primary** production/text source, deduped against the
event-oriented feeds.

Entity vocabulary (theirs → ours):

| theatre.info | Meaning | Maps to Scenes (`packages/db/src/schema.ts`) |
|---|---|---|
| `spectacle` | a production (a staged show) | `events` |
| `texte` | the published play/text staged | `events.author` + future text metadata |
| `structure` | a venue / organisation / publisher | `venues` |
| `personne` | author, director, artist | `events.author` / `events.director` (artists deferred) |
| `calendrier` / dates | performance dates | `performances` (one row per showing) |
| `ville` / `pays` | city / country | venue address / filtering |

---

## 2. Licence — Etalab Licence Ouverte 2.0 (`/licence-etalab`)

The data is published under the **Licence Ouverte / Open Licence version 2.0**
(Etalab). This is the permissive French open-data licence, compatible with
CC-BY 4.0, ODC-BY and the UK OGL.

**What it allows** — non-exclusive, free, worldwide, perpetual right to reproduce,
adapt, modify, extract, transform, and **redistribute, including for commercial
use**. No share-alike / copyleft obligation. This is compatible with our
affiliate-revenue business model.

**The one obligation — attribution.** We must mention the *paternité* of the
information:

> « mentionner la paternité de l'« Information » : sa source (au moins le nom du
> « Concédant ») et la date de dernière mise à jour »

Concretely, wherever we surface theatre.info-sourced data we must show:
- the **source name** — at minimum "theatre.info",
- the **last-update date** of the information,
- (recommended) a **hyperlink** back to the original theatre.info record.

Attribution must **not** suggest theatre.info endorses Scenes or our reuse. Data
is provided "as-is", no warranty; the reuser bears sole responsibility.

**How we comply (design decision):** persist provenance on ingested rows —
source identifier, the theatre.info object id, the source URL, and the record's
last-update timestamp — so the UI can render an attribution line / link on any
piece page fed by theatre.info. The current schema has **no provenance columns
yet** (see the `schema.ts` header note: "provenance once ingestion returns"); add
them as part of this work. → **Action item / decision-log entry.**

---

## 3. Access & API key

- **Docs pages:** `/pour-les-developpeurs` (the real technical reference — richest
  source), `/mode-demploi/utiliser-lapi` (access & resource overview). Note:
  `/mode-demploi` and `/licence-etalab` bare paths behave inconsistently — use the
  full paths above.
- **Getting a key:** you must first have a **user account** on theatre.info, then
  request a key via the contact form: **`/contact/demande_cle_api`** (general
  contact: `/contact`). The key then appears in your account.
- **Access tiers (commercial angle, from `utiliser-lapi`):**
  - Priority / direct API access is reserved for **abonnés Premium** (paying
    subscribers).
  - Non-Premium reusers get a **provisional key** on request, and a **custom quote
    based on usage** — i.e. access may not be free at our volume. **Open question:**
    confirm whether our partner grant is free, provisional, or quoted, and what
    volume it covers. Raise with Théo before we design around unlimited pulls.
- **Extra data when authenticated:** logged-in / API-authorised users see extra
  fields on `spectacle`, `texte`, `structure`, `personne` records — notably the
  **object identifier**, which you then use as a filter in API requests.
- **Not exposed via API:** the long *textes de présentation* (presentation blurbs)
  are excluded — "l'ensemble des données (mis à part les textes de présentation)".

---

## 4. API reference

> Everything below is from the public `/pour-les-developpeurs` page. Response
> **field names / JSON shape are NOT published** — they must be captured from a
> live call once the key lands (see §6).

**Base URL**

```
https://theatre.info/api/
```

**Authentication:** API key required. Header/query mechanism **(to confirm)** —
not documented publicly; determine from the account/key page or a test call.

**Response format:** JSON.

### 4.1 Object identifiers

Records are addressed by a typed id of the form `type:nnn`:

| Entity | Identifier |
|---|---|
| Spectacle | `show:nnn` |
| Texte | `text:nnn` |
| Structure | `structure:nnn` |
| Personne | `person:nnn` |

Ids can be combined comma-separated in a path segment, e.g.
`structure:nnn,person:nnn`.

### 4.2 Endpoints

**Spectacles family**

| Endpoint | Returns |
|---|---|
| `spectacles/spectacle-affiche` | a single show |
| `spectacles/affiche-lieu` | shows on the bill at a venue |
| `spectacles/affiche-production` | shows produced / co-produced by a structure/person |
| `spectacles/affiche-soutien` | shows *supported* by a structure/person |
| `spectacles/affiche-personne` | a person's shows |

**Textes family** (results include the associated spectacle info)

| Endpoint | Returns |
|---|---|
| `textes/texte-affiche` | a single text |
| `textes/affiche-lieu` | texts staged at a venue |
| `textes/affiche-production` | texts in production |
| `textes/affiche-editeur` | a publisher's texts |
| `textes/affiche-personne` | an author's texts |

### 4.3 Filters

Filters go in **square brackets** after the id segment, comma-separated:
`[filter1=value,filter2=value]`.

| Filter | Values | Default |
|---|---|---|
| `from` | `yyyy-mm-dd` | today |
| `to` | `yyyy-mm-dd` | unlimited (no end) |
| `area` | region number `1`–`18`, or ISO 3166-1 alpha-2 country code (e.g. `FR`) | none |
| `role` | `author`, `director` | `director` |

**Pagination / rate limits / update frequency:** not documented. **(to confirm)**
— assume they exist; capture from response headers / trial.

### 4.4 Example request URLs (verbatim from the docs)

```
https://theatre.info/api/spectacles/spectacle-affiche/show:nnn?
https://theatre.info/api/spectacles/affiche-lieu/structure:nnn[area=FR]?
https://theatre.info/api/spectacles/affiche-lieu/structure:nnn,person:nnn[to=2025-12-12]?
https://theatre.info/api/spectacles/affiche-production/structure:nnn,person:nnn[to=2025-12-12,area=FR]?
https://theatre.info/api/textes/affiche-editeur/structure:nnn[area=FR,role=author]?
```

For Scenes (Paris theatre) the likely primary query is **`affiche-lieu` per Paris
venue** (we already maintain a ~200-theatre Paris list — see the venues sheet
memory), plus `spectacle-affiche` to hydrate each show. `area` can scope to `FR`
or the Île-de-France region number **(to confirm which number = IDF)**.

---

## 5. Planned ingestion approach

Two phases, deliberately.

### Phase A — manual exploration & PySpark (before/at key receipt)

Théo's preferred first workflow: **pull manually and process with PySpark
scripts**, to learn the real payload shape, volumes, and dedup keys before
committing to worker code. Rationale: the response schema is undocumented, so we
must inspect real data first; PySpark is fine for a one-off local batch and lets
us prototype the entity-resolution join against the other sources.

Suggested Phase-A layout (kept **out of** `apps/worker` until stabilised):

```
scripts/ingestion/theatre-info/
  pull.py|.sh          # authenticated pulls per Paris venue → raw JSON on disk
  explore.ipynb / .py  # PySpark: flatten, profile fields, find dedup keys
  raw/                 # gitignored dumped JSON responses (never commit the key)
```

- Keep the API key in an env var / `.env` (gitignored), **never** in a committed
  file or a raw dump.
- Persist raw responses verbatim first, transform second — so re-parsing never
  needs a re-pull (respects rate limits and our quota, whatever it turns out to be).
- Goal of Phase A: a documented field map (theatre.info field → Scenes column),
  measured dedup keys (title + venue + date), and confirmed volumes.

### Phase B — the worker source module

Fold the learnings into the existing worker, matching the established pattern.
`apps/worker/src/index.ts` runs `Promise.allSettled([...sources])` daily at
**05:00 Europe/Paris**; each source is a module in `apps/worker/src/sources/`
exporting `ingestX(db): Promise<{ upserted: number }>` (see `openagenda.ts`,
`datatourisme.ts`, `francebillet.ts` — all currently TODO stubs).

Add `apps/worker/src/sources/theatreinfo.ts` and wire it into `runIngestion()`
alongside the others. Responsibilities:

1. For each tracked Paris venue (`structure:nnn`), call `affiche-lieu` with a
   `from`/`to` window; hydrate shows via `spectacle-affiche` as needed.
2. Upsert keyed on `(source, sourceRef)` where `sourceRef` is the theatre.info
   object id — the same "upsert on source + sourceRef" contract the OpenAgenda
   stub documents.
3. Map to our schema: `spectacle` → `events` (+ slug), `structure` → `venues`,
   dates → `performances` (one row per showing), `personne` → `author`/`director`.
4. Record provenance (source, object id, source URL, last-update date) for
   attribution (§2) and dedup.

Cross-source **entity resolution / dedup** is still an open TODO in `index.ts`
(match on title + venue + dates). theatre.info is likely the highest-quality
*production* record; the ticketing feeds (France Billet) carry the affiliate URL.
Design the merge so theatre.info can be the canonical production while a France
Billet match supplies the buy link.

---

## 6. What to confirm the moment the key arrives

Blocking unknowns — resolve these against a live call before writing Phase-B code:

1. **Auth mechanism** — header name vs query param; exact key placement.
2. **Response JSON shape** — capture full payloads for `spectacle-affiche` and
   `affiche-lieu`; write the field map. This is the single biggest gap.
3. **Pagination** — how large result sets are paged (cursor? offset? page size?).
4. **Rate limits & quota** — headers, per-day caps; whether our grant is free.
5. **Update frequency** — how fresh the data is, to set our cron cadence.
6. **`area` region numbers** — which of `1`–`18` is Île-de-France / Paris.
7. **Venue id discovery** — how to resolve our ~200 Paris venues to `structure:nnn`
   ids (search endpoint? one-time manual mapping?).
8. **Dates granularity** — does the API return per-showing datetimes (matinée vs
   soirée) or just date ranges — decides how faithfully we fill `performances`.

---

## 7. Open decisions for Théo

- **Commercial terms:** is the partner key free at our volume, or subject to the
  "custom quote based on usage" / Premium tier? Confirm before we depend on it.
- **Provenance columns:** approve adding source/provenance fields to `venues` and
  `events` (needed for licence compliance). Log the decision in
  `scenes-knowledge-base.md` once agreed.
- **Source priority:** confirm theatre.info becomes the canonical *production*
  source, with ticketing feeds contributing only affiliate links.

## Sources

- [theatre.info — Pour les développeurs](https://theatre.info/pour-les-developpeurs)
- [theatre.info — Utiliser via l'API](https://theatre.info/mode-demploi/utiliser-lapi)
- [theatre.info — Licence Ouverte / Etalab](https://theatre.info/licence-etalab)
- [Demande de clé API](https://theatre.info/contact/demande_cle_api)
- [Etalab Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/)
