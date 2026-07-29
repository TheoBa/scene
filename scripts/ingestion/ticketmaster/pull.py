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


def sweep_window(key: str, args, win_start: datetime, win_end: datetime,
                 out_dir: Path) -> tuple[int, bool]:
    """Page through one date window. Returns (events_saved, hit_cap)."""
    base = {
        "apikey": key,
        "countryCode": args.country,
        "locale": args.locale,
        "size": PAGE_SIZE,
        "sort": "date,asc",
        "startDateTime": iso_z(win_start),
        "endDateTime": iso_z(win_end),
    }
    if args.city:
        base["city"] = args.city
    if args.classification:
        base["classificationName"] = args.classification
    if args.venue_ids:
        base["venueId"] = args.venue_ids  # comma-separated, precise + low-noise

    saved, hit_cap = 0, False
    tag = win_start.strftime("%Y%m%d")
    for page in range(MAX_PAGES):
        params = {**base, "page": page}
        data = fetch_page(params)
        time.sleep(MIN_INTERVAL_S)

        page_info = data.get("page", {})
        total = page_info.get("totalElements", 0)
        events = data.get("_embedded", {}).get("events", [])

        # Persist the raw response verbatim, one file per page.
        (out_dir / f"events_{tag}_p{page}.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        saved += len(events)

        if page == 0 and total > 1000:
            hit_cap = True
            print(f"  ⚠ window {tag}: {total} events > 1000 deep-paging cap — "
                  f"narrow --window-days or add --classification/--venue-ids")
        if not events or (page + 1) >= page_info.get("totalPages", 0):
            break
    return saved, hit_cap


def main() -> None:
    p = argparse.ArgumentParser(description="Ticketmaster Paris Phase-A pull")
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    p.add_argument("--start", default=today.strftime("%Y-%m-%d"),
                   help="inclusive window start, YYYY-MM-DD (default: today)")
    p.add_argument("--end", default=(today + timedelta(days=90)).strftime("%Y-%m-%d"),
                   help="exclusive window end, YYYY-MM-DD (default: +90d)")
    p.add_argument("--window-days", type=int, default=7,
                   help="date-partition size in days (default: 7)")
    p.add_argument("--city", default="Paris")
    p.add_argument("--country", default="FR")
    p.add_argument("--locale", default="fr")
    p.add_argument("--classification", default="Theatre",
                   help='classificationName filter; "" to disable, '
                        '"Arts & Theatre" to widen to the noisy segment')
    p.add_argument("--venue-ids", default="",
                   help="comma-separated TM venueIds — most precise filter")
    p.add_argument("--out", default=str(Path(__file__).parent / "raw"))
    args = p.parse_args()

    key = load_key()
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    start = datetime.strptime(args.start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    end = datetime.strptime(args.end, "%Y-%m-%d").replace(tzinfo=timezone.utc)

    print(f"Sweeping {args.start}→{args.end} in {args.window_days}d windows | "
          f"city={args.city} country={args.country} "
          f"classification={args.classification or '(none)'}")

    total_saved, capped_windows, cursor = 0, 0, start
    while cursor < end:
        win_end = min(cursor + timedelta(days=args.window_days), end)
        saved, hit_cap = sweep_window(key, args, cursor, win_end, out_dir)
        print(f"  {cursor:%Y-%m-%d} → {win_end:%Y-%m-%d}: {saved} events")
        total_saved += saved
        capped_windows += int(hit_cap)
        cursor = win_end

    print(f"\nDone. {total_saved} event rows across raw JSON in {out_dir}")
    if capped_windows:
        print(f"⚠ {capped_windows} window(s) exceeded the 1000-item cap — some "
              f"events were missed there. Re-run those with a smaller "
              f"--window-days or a tighter filter.")
    print("Next: python profile_spark.py")


if __name__ == "__main__":
    main()
