#!/usr/bin/env python3
"""Phase-A pull: sweep Ticketmaster Discovery for Paris cultural events → raw JSON.

Design notes (see docs/ingestion_ticketmaster.md):
- Auth: `apikey` query param = the Consumer Key, read from TICKETMASTER_API_KEY
  (loaded from the gitignored root .env). The Consumer Secret is NOT used.
- Deep-paging cap: the API only returns up to the 1000th item, i.e. page*size < 1000.
  With size=200 that's pages 0..4. To sweep a larger result set we PARTITION by
  date window; if a single window still exceeds 1000 items the script WARNS so you
  can narrow the window or add a genre/venue filter.
- Rate limits: 5 req/s and 5000 calls/day. We throttle to stay well under both.
- "Arts & Theatre" the *segment* is noisy (it returned a kids' science museum);
  we default to the Theatre *genre* via --classification "Theatre". Widen or pass
  --venue-ids for a precise, low-noise pull.

Raw responses are saved verbatim (one file per API page) so re-parsing never needs
a re-pull. Transform happens later in profile_spark.py.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - guidance for first run
    print("Missing deps. Run: pip install -r requirements.txt", file=sys.stderr)
    raise

BASE_URL = "https://app.ticketmaster.com/discovery/v2/events.json"
PAGE_SIZE = 200            # API max; pages 0..4 gives the 1000-item ceiling
MAX_PAGES = 1000 // PAGE_SIZE  # deep-paging cap: never request beyond item 1000
MIN_INTERVAL_S = 0.25     # < 5 req/s (with margin)
REPO_ROOT = Path(__file__).resolve().parents[3]

# Segment "Arts et Théâtre" (KZFzniwnSyZfZ7v7na) is noisy — its "Culturel" genre
# is museum exhibitions (~75% of Paris results). Filter by genreId instead. These
# are the theatre-relevant genres (resolved live 2026-07-29, locale=fr); ~539
# events/week in Paris, safely under the 1000-item cap. See docs/ingestion_ticketmaster.md.
GENRES = {
    "KnvZfZ7v7l1": "Théâtre",
    "KnvZfZ7v7na": "Théâtre pour enfants",
    "KnvZfZ7v7ld": "Théâtre - Divers",
    "KnvZfZ7vAe1": "Humour",            # café-théâtre / one-man-show — core Paris
    "KnvZfZ7v7lF": "Marionettes",
}
DEFAULT_GENRE_IDS = ",".join(GENRES)


def load_key() -> str:
    # .env lives at the repo root; load it regardless of cwd.
    load_dotenv(REPO_ROOT / ".env")
    key = os.environ.get("TICKETMASTER_API_KEY")
    if not key:
        sys.exit(
            "TICKETMASTER_API_KEY not set. Add it to the root .env "
            "(see .env.example) — it's the Ticketmaster Consumer Key."
        )
    return key


def iso_z(dt: datetime) -> str:
    # Discovery wants UTC as YYYY-MM-DDTHH:mm:ssZ (no offset, literal Z).
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_page(params: dict) -> dict:
    """One GET with basic 429/5xx backoff. Returns parsed JSON."""
    url = f"{BASE_URL}?{urlencode(params)}"
    for attempt in range(5):
        try:
            with urlopen(Request(url), timeout=30) as resp:
                return json.load(resp)
        except HTTPError as e:
            if e.code == 429 or 500 <= e.code < 600:
                wait = 2 ** attempt
                print(f"  [{e.code}] backing off {wait}s", file=sys.stderr)
                time.sleep(wait)
                continue
            body = e.read().decode("utf-8", "replace")[:300]
            sys.exit(f"HTTP {e.code} — {body}")
        except URLError as e:
            sys.exit(f"Network error: {e.reason}")
    sys.exit("Giving up after repeated rate-limit/5xx responses.")


def window_params(key: str, args, win_start: datetime, win_end: datetime) -> dict:
    base = {
        "apikey": key,
        "countryCode": args.country,
        "locale": args.locale,
        "sort": "date,asc",
        "startDateTime": iso_z(win_start),
        "endDateTime": iso_z(win_end),
    }
    if args.city:
        base["city"] = args.city
    if args.genre_ids:
        base["genreId"] = args.genre_ids  # theatre genres — dodges the Culturel noise
    if args.classification:
        base["classificationName"] = args.classification
    if args.venue_ids:
        base["venueId"] = args.venue_ids  # comma-separated, precise + low-noise
    return base


def count_window(base: dict) -> int:
    """Cheap size=1 request → totalElements, to decide whether to split."""
    data = fetch_page({**base, "size": 1, "page": 0})
    time.sleep(MIN_INTERVAL_S)
    return data.get("page", {}).get("totalElements", 0)


def save_window(base: dict, tag: str, out_dir: Path) -> int:
    """Page through a window known to be within the cap; save raw pages."""
    saved = 0
    for page in range(MAX_PAGES):
        data = fetch_page({**base, "size": PAGE_SIZE, "page": page})
        time.sleep(MIN_INTERVAL_S)
        page_info = data.get("page", {})
        events = data.get("_embedded", {}).get("events", [])
        (out_dir / f"events_{tag}_p{page}.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        saved += len(events)
        if not events or (page + 1) >= page_info.get("totalPages", 0):
            break
    return saved


def process_window(key: str, args, win_start: datetime, win_end: datetime,
                   out_dir: Path) -> tuple[int, int]:
    """Adaptive: bisect any window over the 1000-item cap until each slice fits.
    Returns (events_saved, uncoverable_windows)."""
    base = window_params(key, args, win_start, win_end)
    total = count_window(base)
    days = (win_end - win_start).days
    label = f"{win_start:%Y-%m-%d}→{win_end:%Y-%m-%d}"

    if total > 1000 and days > 1:
        mid = win_start + timedelta(days=days // 2)  # days>1 ⇒ mid strictly inside
        print(f"  {label}: {total} > cap — splitting")
        s1, u1 = process_window(key, args, win_start, mid, out_dir)
        s2, u2 = process_window(key, args, mid, win_end, out_dir)
        return s1 + s2, u1 + u2

    tag = win_start.strftime("%Y%m%d")
    saved = save_window(base, tag, out_dir)
    if total > 1000:  # 1-day floor still over cap — implausible for Paris theatre
        print(f"  ⚠ {label}: {total} > cap at 1-day floor — some events missed")
        return saved, 1
    print(f"  {label}: {saved} events")
    return saved, 0


def main() -> None:
    p = argparse.ArgumentParser(description="Ticketmaster Paris Phase-A pull")
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    p.add_argument("--start", default=today.strftime("%Y-%m-%d"),
                   help="inclusive window start, YYYY-MM-DD (default: today)")
    p.add_argument("--end", default=(today + timedelta(days=90)).strftime("%Y-%m-%d"),
                   help="exclusive window end, YYYY-MM-DD (default: +90d)")
    p.add_argument("--window-days", type=int, default=7,
                   help="initial date-partition size in days (default: 7); windows "
                        "over the 1000-item cap are auto-bisected")
    p.add_argument("--city", default="Paris")
    p.add_argument("--country", default="FR")
    p.add_argument("--locale", default="fr")
    p.add_argument("--genre-ids", default=DEFAULT_GENRE_IDS,
                   help=f"comma-separated TM genreIds (default: theatre genres "
                        f"{DEFAULT_GENRE_IDS}); \"\" to disable")
    p.add_argument("--classification", default="",
                   help='optional classificationName filter (loose keyword match; '
                        'prefer --genre-ids for precision)')
    p.add_argument("--venue-ids", default="",
                   help="comma-separated TM venueIds — most precise filter")
    p.add_argument("--out", default=str(Path(__file__).parent / "raw"))
    args = p.parse_args()

    key = load_key()
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    start = datetime.strptime(args.start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    end = datetime.strptime(args.end, "%Y-%m-%d").replace(tzinfo=timezone.utc)

    genre_names = ", ".join(GENRES.get(g, g) for g in args.genre_ids.split(",") if g)
    print(f"Sweeping {args.start}→{args.end} in {args.window_days}d windows "
          f"(auto-bisected past the cap) | city={args.city} "
          f"country={args.country} | genres=[{genre_names or '(all)'}]")

    total_saved, uncoverable, cursor = 0, 0, start
    while cursor < end:
        win_end = min(cursor + timedelta(days=args.window_days), end)
        saved, unc = process_window(key, args, cursor, win_end, out_dir)
        total_saved += saved
        uncoverable += unc
        cursor = win_end

    print(f"\nDone. {total_saved} event rows across raw JSON in {out_dir}")
    if uncoverable:
        print(f"⚠ {uncoverable} single-day window(s) still exceeded the cap — "
              f"unusual; consider a tighter --genre-ids or --venue-ids there.")
    print("Next: python profile_spark.py")


if __name__ == "__main__":
    main()
