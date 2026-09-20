import { describe, expect, it } from "vitest";

import { generateApiKey, hashApiKey } from "@/lib/api/auth";
import { toSearchQuery } from "@/lib/search/types";
import { nextRunFor } from "@/lib/services/alerts";
import { mapStripeStatus, toDate } from "@/lib/billing/stripe";

describe("generateApiKey", () => {
  it("returns a prefixed key with its hash", () => {
    const key = generateApiKey();
    expect(key.plaintext.startsWith("ci_live_")).toBe(true);
    expect(key.prefix.startsWith("ci_live_")).toBe(true);
    expect(key.hashedKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never stores the plaintext in the hash", () => {
    const key = generateApiKey();
    expect(key.hashedKey).not.toContain(key.plaintext);
    expect(hashApiKey(key.plaintext)).toBe(key.hashedKey);
  });

  it("produces a unique key every time", () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey().plaintext));
    expect(keys.size).toBe(50);
  });

  it("derives the prefix from the start of the key so lookup is possible", () => {
    const key = generateApiKey();
    expect(key.plaintext.startsWith(key.prefix)).toBe(true);
    expect(key.prefix.length).toBe("ci_live_".length + 8);
  });
});

describe("hashApiKey", () => {
  it("is deterministic", () => {
    expect(hashApiKey("ci_live_abc")).toBe(hashApiKey("ci_live_abc"));
  });

  it("differs for different keys", () => {
    expect(hashApiKey("ci_live_abc")).not.toBe(hashApiKey("ci_live_abd"));
  });
});

describe("toSearchQuery", () => {
  it("passes normal queries through", () => {
    expect(toSearchQuery("manufacturing cardiff")).toBe("manufacturing cardiff");
  });

  it("strips control characters", () => {
    expect(toSearchQuery("abc\u0000def")).toBe("abc def");
  });

  it("caps length so an enormous query cannot be sent to the database", () => {
    expect(toSearchQuery("a".repeat(500))?.length).toBe(200);
  });

  it("returns null for empty input", () => {
    expect(toSearchQuery("")).toBeNull();
    expect(toSearchQuery("   ")).toBeNull();
    expect(toSearchQuery(null)).toBeNull();
    expect(toSearchQuery(undefined)).toBeNull();
  });

  it("keeps quoted phrases intact for websearch_to_tsquery", () => {
    expect(toSearchQuery('"renewable energy"')).toBe('"renewable energy"');
  });
});

describe("nextRunFor", () => {
  const from = new Date("2026-01-01T09:00:00Z");

  it("schedules hourly for immediate alerts", () => {
    expect(nextRunFor("IMMEDIATE", from).toISOString()).toBe("2026-01-01T10:00:00.000Z");
  });

  it("schedules daily alerts a day out", () => {
    expect(nextRunFor("DAILY", from).toISOString()).toBe("2026-01-02T09:00:00.000Z");
  });

  it("schedules weekly alerts a week out", () => {
    expect(nextRunFor("WEEKLY", from).toISOString()).toBe("2026-01-08T09:00:00.000Z");
  });

  it("does not mutate the input date", () => {
    const original = new Date(from);
    nextRunFor("WEEKLY", from);
    expect(from.toISOString()).toBe(original.toISOString());
  });
});

describe("mapStripeStatus", () => {
  it("maps the documented statuses", () => {
    expect(mapStripeStatus("active")).toBe("ACTIVE");
    expect(mapStripeStatus("trialing")).toBe("TRIALING");
    expect(mapStripeStatus("past_due")).toBe("PAST_DUE");
    expect(mapStripeStatus("canceled")).toBe("CANCELED");
    expect(mapStripeStatus("unpaid")).toBe("UNPAID");
  });

  it("fails closed on an unknown status rather than granting access", () => {
    expect(mapStripeStatus("something_new" as never)).toBe("INCOMPLETE");
  });
});

describe("toDate", () => {
  it("converts Stripe epoch seconds to a Date", () => {
    expect(toDate(1767225600)?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("returns null for absent or invalid values", () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate(Number.NaN)).toBeNull();
  });
});
