/**
 * Sliding-window rate limiter.
 *
 * Publishers such as Companies House document a hard limit (600 requests per
 * 5 minutes per key) and return HTTP 429 with a Retry-After header when it is
 * exceeded. This limiter keeps us under the published limit proactively rather
 * than relying on being rejected.
 *
 * Scope: one process. Ingestion runs inside a single cron invocation so this is
 * the correct boundary for that work. Request-path callers that must share a
 * budget across instances should use the database-backed limiter in
 * src/lib/api/rate-limit.ts instead.
 */
export class SlidingWindowRateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private timestamps: number[] = [];

  constructor(limit: number, windowMs: number) {
    if (limit <= 0) throw new Error("Rate limit must be greater than zero");
    if (windowMs <= 0) throw new Error("Rate window must be greater than zero");
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Number of requests still available in the current window. */
  remaining(now: number = Date.now()): number {
    this.prune(now);
    return Math.max(0, this.limit - this.timestamps.length);
  }

  /**
   * Milliseconds to wait before another request may be made. Zero when a slot
   * is available immediately.
   */
  retryAfterMs(now: number = Date.now()): number {
    this.prune(now);
    if (this.timestamps.length < this.limit) return 0;
    const oldest = this.timestamps[0];
    return Math.max(0, oldest + this.windowMs - now);
  }

  /**
   * Waits until a slot is free, then records the request.
   * `sleep` is injectable so tests do not need real timers.
   */
  async acquire(sleep: (ms: number) => Promise<void> = defaultSleep): Promise<void> {
    // Loop rather than wait once: other callers may take the freed slot first.
    for (;;) {
      const wait = this.retryAfterMs();
      if (wait === 0) break;
      await sleep(wait);
    }
    this.timestamps.push(Date.now());
  }

  /** Records a request without waiting. Used when replaying cached responses. */
  record(now: number = Date.now()): void {
    this.prune(now);
    this.timestamps.push(now);
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    // Timestamps are appended in order, so dropping the leading expired run is
    // enough and keeps this O(expired) rather than O(n).
    let firstValid = 0;
    while (firstValid < this.timestamps.length && this.timestamps[firstValid] <= cutoff) {
      firstValid += 1;
    }
    if (firstValid > 0) {
      this.timestamps = this.timestamps.slice(firstValid);
    }
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const limiters = new Map<string, SlidingWindowRateLimiter>();

/** Returns the shared limiter for a named upstream, creating it on first use. */
export function getRateLimiter(
  key: string,
  limit: number,
  windowMs: number
): SlidingWindowRateLimiter {
  const existing = limiters.get(key);
  if (existing) return existing;
  const created = new SlidingWindowRateLimiter(limit, windowMs);
  limiters.set(key, created);
  return created;
}

/** Test helper — drops all shared limiters. */
export function resetRateLimiters(): void {
  limiters.clear();
}
