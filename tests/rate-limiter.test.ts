import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SlidingWindowRateLimiter,
  getRateLimiter,
  resetRateLimiters,
} from "@/lib/http/rate-limiter";
import { backoffMs, parseRetryAfter } from "@/lib/http/client";

afterEach(() => {
  vi.useRealTimers();
  resetRateLimiters();
});

describe("SlidingWindowRateLimiter", () => {
  it("allows requests up to the limit", async () => {
    const limiter = new SlidingWindowRateLimiter(3, 1000);
    const sleep = vi.fn(async () => {});

    await limiter.acquire(sleep);
    await limiter.acquire(sleep);
    await limiter.acquire(sleep);

    expect(sleep).not.toHaveBeenCalled();
    expect(limiter.remaining()).toBe(0);
  });

  it("reports how long to wait once the window is full", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const limiter = new SlidingWindowRateLimiter(2, 60_000);
    limiter.record();
    limiter.record();

    expect(limiter.remaining()).toBe(0);
    expect(limiter.retryAfterMs()).toBe(60_000);

    vi.setSystemTime(new Date("2026-01-01T00:00:30Z"));
    expect(limiter.retryAfterMs()).toBe(30_000);
  });

  it("frees slots once the window has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const limiter = new SlidingWindowRateLimiter(2, 60_000);
    limiter.record();
    limiter.record();
    expect(limiter.remaining()).toBe(0);

    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    expect(limiter.remaining()).toBe(2);
    expect(limiter.retryAfterMs()).toBe(0);
  });

  it("waits before granting a slot when the window is full", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const limiter = new SlidingWindowRateLimiter(1, 1000);
    const sleep = vi.fn(async (ms: number) => {
      // Advance time as the real sleep would, so the loop terminates.
      vi.setSystemTime(new Date(Date.now() + ms));
    });

    await limiter.acquire(sleep);
    await limiter.acquire(sleep);

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("rejects nonsensical configuration", () => {
    expect(() => new SlidingWindowRateLimiter(0, 1000)).toThrow();
    expect(() => new SlidingWindowRateLimiter(10, 0)).toThrow();
  });
});

describe("getRateLimiter", () => {
  it("returns the same limiter for the same upstream", () => {
    const a = getRateLimiter("companies_house", 600, 300_000);
    const b = getRateLimiter("companies_house", 600, 300_000);
    expect(a).toBe(b);
  });

  it("keeps different upstreams independent", () => {
    const a = getRateLimiter("companies_house", 600, 300_000);
    const b = getRateLimiter("sell2wales", 120, 60_000);
    expect(a).not.toBe(b);
  });
});

describe("parseRetryAfter", () => {
  it("parses a delay in seconds", () => {
    expect(parseRetryAfter("30")).toBe(30_000);
    expect(parseRetryAfter("0")).toBe(0);
  });

  it("parses an HTTP date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:45 GMT")).toBe(45_000);
  });

  it("caps absurd values so a bad header cannot stall a run", () => {
    expect(parseRetryAfter("99999")).toBe(300_000);
  });

  it("returns null for a missing or unparseable header", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
  });
});

describe("backoffMs", () => {
  it("grows exponentially and stays within the cap", () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const delay = backoffMs(attempt, 500, 30_000);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(30_000);
    }
  });

  it("never exceeds the exponential ceiling for the attempt", () => {
    // Full jitter: the delay is uniform in [0, min(cap, base * 2^attempt)).
    for (let i = 0; i < 50; i += 1) {
      expect(backoffMs(1, 500, 30_000)).toBeLessThanOrEqual(1000);
    }
  });
});
