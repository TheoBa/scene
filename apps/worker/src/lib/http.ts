/**
 * Throttled JSON GET with a per-run request budget — the TS port of pull.py's
 * `fetch_page`. Ticketmaster's limits are 5 req/s and 5000 calls/day; this client
 * spaces requests under the per-second limit, retries 429/5xx with exponential
 * backoff, and refuses to exceed a hard per-run call budget so a nightly sweep can
 * never blow the daily quota (default cap sits well under 5000).
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Budget {
  /** Hard cap on API calls this run may make (kept well under 5000/day). */
  maxRequests: number;
  /** Minimum spacing between requests, ms (< 5 req/s → ≥ 200ms; we use 250). */
  minIntervalMs: number;
}

export const DEFAULT_BUDGET: Budget = { maxRequests: 4000, minIntervalMs: 250 };

/** Thrown when the request budget is reached — callers stop the sweep cleanly. */
export class BudgetExceededError extends Error {
  constructor(max: number) {
    super(`request budget of ${max} calls reached — stopping to protect the daily quota`);
    this.name = "BudgetExceededError";
  }
}

export class ThrottledClient {
  private count = 0;
  private lastAt = 0;

  constructor(private readonly budget: Budget = DEFAULT_BUDGET) {}

  /** API calls actually made so far (each response received counts, retries included). */
  get requests(): number {
    return this.count;
  }

  get budgetExhausted(): boolean {
    return this.count >= this.budget.maxRequests;
  }

  /** GET `url` and parse JSON. Throttles, retries transient errors, honours the budget. */
  async getJson<T = unknown>(url: string): Promise<T> {
    if (this.budgetExhausted) throw new BudgetExceededError(this.budget.maxRequests);
    await this.throttle();

    for (let attempt = 0; attempt < 5; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      } catch (err) {
        // Network/timeout — the call likely never reached TM, so don't count it.
        if (attempt === 4) throw err;
        await sleep(2 ** attempt * 1000);
        continue;
      }
      this.count++; // a response came back → it counted against the quota
      if (res.ok) return (await res.json()) as T;
      if (res.status === 429 || res.status >= 500) {
        const wait = 2 ** attempt * 1000;
        console.warn(`[http] ${res.status} — backing off ${wait}ms`);
        await sleep(wait);
        continue;
      }
      const body = (await res.text()).slice(0, 300);
      throw new Error(`HTTP ${res.status} — ${body}`);
    }
    throw new Error("giving up after repeated rate-limit/5xx responses");
  }

  private async throttle(): Promise<void> {
    const wait = this.budget.minIntervalMs - (Date.now() - this.lastAt);
    if (wait > 0) await sleep(wait);
    this.lastAt = Date.now();
  }
}
