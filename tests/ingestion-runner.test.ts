import { describe, expect, it } from "vitest";

import { emptyCounters, hashPayload, stableStringify } from "@/lib/ingestion/runner";

describe("stableStringify", () => {
  it("produces the same string regardless of key order", () => {
    const a = { name: "ABC Ltd", number: "01234567", sic: ["25620"] };
    const b = { sic: ["25620"], number: "01234567", name: "ABC Ltd" };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("preserves array order, which is meaningful", () => {
    expect(stableStringify(["a", "b"])).not.toBe(stableStringify(["b", "a"]));
  });

  it("handles nested objects", () => {
    const a = { outer: { z: 1, a: 2 } };
    const b = { outer: { a: 2, z: 1 } };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("ignores undefined values so an absent field matches an omitted one", () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });

  it("handles primitives and null", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(42)).toBe("42");
    expect(stableStringify("text")).toBe('"text"');
    expect(stableStringify(true)).toBe("true");
  });
});

describe("hashPayload", () => {
  it("is stable across key ordering, so an unchanged record is detected as unchanged", () => {
    const first = hashPayload({ company_number: "01234567", company_name: "ABC Ltd" });
    const second = hashPayload({ company_name: "ABC Ltd", company_number: "01234567" });
    expect(first).toBe(second);
  });

  it("changes when any value changes", () => {
    const before = hashPayload({ status: "active" });
    const after = hashPayload({ status: "dissolved" });
    expect(before).not.toBe(after);
  });

  it("returns a hex sha256 digest", () => {
    expect(hashPayload({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("emptyCounters", () => {
  it("starts every counter at zero", () => {
    expect(emptyCounters()).toEqual({
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      rejected: 0,
    });
  });

  it("returns a fresh object each call", () => {
    const a = emptyCounters();
    a.fetched = 5;
    expect(emptyCounters().fetched).toBe(0);
  });
});
