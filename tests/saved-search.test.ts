import { describe, expect, it } from "vitest";

import {
  captureSearch,
  describeSavedSearch,
  isEmptySearch,
  isSaveableEntityType,
  savedSearchHref,
} from "@/lib/search/saved-search";

describe("captureSearch", () => {
  it("keeps the query separate from the filters", () => {
    const result = captureSearch("COMPANY", { q: "solar", region: "SOUTH_WEST" });
    expect(result.query).toBe("solar");
    expect(result.filters).toEqual({ region: "SOUTH_WEST" });
  });

  it("drops pagination so a saved search always re-runs from the first page", () => {
    const result = captureSearch("COMPANY", { q: "solar", page: "7", perPage: "50" });
    expect(result.filters).not.toHaveProperty("page");
    expect(result.filters).not.toHaveProperty("perPage");
  });

  it("drops default values so identical searches compare equal", () => {
    const explicit = captureSearch("COMPANY", { q: "solar", sort: "relevance", welshOnly: "true" });
    const implicit = captureSearch("COMPANY", { q: "solar" });
    expect(explicit).toEqual(implicit);
  });

  it("keeps a non-default sort", () => {
    const result = captureSearch("COMPANY", { q: "solar", sort: "newest" });
    expect(result.filters.sort).toBe("newest");
  });

  it("normalises a single-valued array filter into an array", () => {
    const result = captureSearch("COMPANY", { status: "ACTIVE" });
    expect(result.filters.status).toEqual(["ACTIVE"]);
  });

  it("preserves multi-valued array filters", () => {
    const result = captureSearch("COMPANY", { status: ["ACTIVE", "DISSOLVED"] });
    expect(result.filters.status).toEqual(["ACTIVE", "DISSOLVED"]);
  });

  it("drops filters the schema does not recognise", () => {
    const result = captureSearch("COMPANY", { q: "solar", somethingElse: "injected" });
    expect(result.filters).not.toHaveProperty("somethingElse");
  });

  it("falls back to the query alone when a filter is malformed", () => {
    // minValue is coerced to a number by the procurement schema; a value that
    // cannot be coerced must not cost the user their search term.
    const result = captureSearch("PROCUREMENT", { q: "roadworks", minValue: "not-a-number" });
    expect(result.query).toBe("roadworks");
    expect(result.filters).toEqual({});
  });

  it("captures procurement value bounds", () => {
    const result = captureSearch("PROCUREMENT", { minValue: "50000", maxValue: "250000" });
    expect(result.filters).toEqual({ minValue: 50000, maxValue: 250000 });
  });
});

describe("isEmptySearch", () => {
  it("is true when there is no query and no filter", () => {
    expect(isEmptySearch(captureSearch("COMPANY", {}))).toBe(true);
    expect(isEmptySearch(captureSearch("COMPANY", { page: "3" }))).toBe(true);
  });

  it("is false once anything has been searched for", () => {
    expect(isEmptySearch(captureSearch("COMPANY", { q: "solar" }))).toBe(false);
    expect(isEmptySearch(captureSearch("COMPANY", { region: "SOUTH_WEST" }))).toBe(false);
  });
});

describe("savedSearchHref", () => {
  it("round-trips a captured search back into the same filters", () => {
    const original = { q: "solar", region: "SOUTH_WEST", status: ["ACTIVE"], sort: "newest" };
    const captured = captureSearch("COMPANY", original);
    const href = savedSearchHref("COMPANY", captured.query, captured.filters);

    const [path, queryString] = href.split("?");
    expect(path).toBe("/dashboard/companies");

    const params = new URLSearchParams(queryString);
    const rebuilt = captureSearch("COMPANY", {
      q: params.get("q") ?? undefined,
      region: params.get("region") ?? undefined,
      status: params.getAll("status"),
      sort: params.get("sort") ?? undefined,
    });
    expect(rebuilt).toEqual(captured);
  });

  it("returns the bare path when there is nothing to encode", () => {
    expect(savedSearchHref("PLANNING", null, {})).toBe("/dashboard/planning");
  });

  it("repeats array filters as separate parameters", () => {
    const href = savedSearchHref("COMPANY", null, { status: ["ACTIVE", "DISSOLVED"] });
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.getAll("status")).toEqual(["ACTIVE", "DISSOLVED"]);
  });

  it("flattens a nested radius into its component parameters", () => {
    const href = savedSearchHref("COMPANY", null, {
      radius: { latitude: 51.48, longitude: -3.18, radiusKm: 10 },
    });
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("latitude")).toBe("51.48");
    expect(params.get("radiusKm")).toBe("10");
  });
});

describe("describeSavedSearch", () => {
  it("quotes the query and labels the filters", () => {
    expect(describeSavedSearch("solar", { region: "SOUTH_WEST" })).toBe(
      "“solar” · region: SOUTH_WEST"
    );
  });

  it("joins array filters", () => {
    expect(describeSavedSearch(null, { status: ["ACTIVE", "DISSOLVED"] })).toBe(
      "status: ACTIVE, DISSOLVED"
    );
  });

  it("says so when a search has no constraints at all", () => {
    expect(describeSavedSearch(null, {})).toBe("All records");
  });
});

describe("isSaveableEntityType", () => {
  it("accepts the entity types with a search page", () => {
    expect(isSaveableEntityType("COMPANY")).toBe(true);
    expect(isSaveableEntityType("PROCUREMENT")).toBe(true);
  });

  it("rejects entity types that have no filter schema", () => {
    expect(isSaveableEntityType("JOB")).toBe(false);
    expect(isSaveableEntityType("INFRASTRUCTURE")).toBe(false);
  });
});
