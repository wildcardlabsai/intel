import { describe, expect, it } from "vitest";

import {
  buildSystemPrompt,
  buildVocabulary,
  interpretationSchema,
  isEmptyInterpretation,
  validateInterpretation,
  type RawInterpretation,
} from "@/lib/ai/query-interpreter";

const AUTHORITIES = [
  { slug: "gwynedd", name: "Gwynedd", welshName: "Gwynedd" },
  { slug: "cardiff", name: "Cardiff", welshName: "Caerdydd" },
  { slug: "isle-of-anglesey", name: "Isle of Anglesey", welshName: "Ynys Môn" },
];

const VOCABULARY = buildVocabulary(AUTHORITIES);

function raw(overrides: Partial<RawInterpretation> = {}): RawInterpretation {
  return {
    keywords: null,
    region: null,
    localAuthority: null,
    postcode: null,
    town: null,
    statuses: [],
    sizeBands: [],
    sicCodes: [],
    incorporatedFrom: null,
    incorporatedTo: null,
    sort: null,
    unresolved: [],
    ...overrides,
  };
}

describe("validateInterpretation", () => {
  it("accepts values that are in the vocabulary", () => {
    const result = validateInterpretation(
      raw({ region: "NORTH_WALES", statuses: ["ACTIVE"], keywords: "construction" }),
      VOCABULARY
    );
    expect(result.filters.region).toBe("NORTH_WALES");
    expect(result.filters.status).toEqual(["ACTIVE"]);
    expect(result.filters.q).toBe("construction");
    expect(result.dropped).toEqual([]);
  });

  it("drops a region the dataset does not have, and says so", () => {
    const result = validateInterpretation(raw({ region: "Yorkshire" }), VOCABULARY);
    expect(result.filters.region).toBeUndefined();
    expect(result.dropped).toEqual(['region “Yorkshire”']);
  });

  it("drops an invented local authority rather than guessing a near match", () => {
    const result = validateInterpretation(raw({ localAuthority: "Llanelli" }), VOCABULARY);
    expect(result.filters.localAuthority).toBeUndefined();
    expect(result.dropped).toEqual(['authority “Llanelli”']);
  });

  it("resolves an authority by slug, English name or Welsh name", () => {
    for (const value of ["cardiff", "Cardiff", "Caerdydd"]) {
      const result = validateInterpretation(raw({ localAuthority: value }), VOCABULARY);
      expect(result.filters.localAuthority).toBe("cardiff");
    }
  });

  it("drops a status that is not a real company status", () => {
    const result = validateInterpretation(
      raw({ statuses: ["ACTIVE", "THRIVING"] }),
      VOCABULARY
    );
    expect(result.filters.status).toEqual(["ACTIVE"]);
    expect(result.dropped).toEqual(['status “THRIVING”']);
  });

  it("normalises loose casing and spacing on enum values", () => {
    const result = validateInterpretation(
      raw({ region: "north wales", statuses: ["active"] }),
      VOCABULARY
    );
    expect(result.filters.region).toBe("NORTH_WALES");
    expect(result.filters.status).toEqual(["ACTIVE"]);
    expect(result.dropped).toEqual([]);
  });

  it("expands a bare year to the start or end of that year", () => {
    const result = validateInterpretation(
      raw({ incorporatedFrom: "2020", incorporatedTo: "2023" }),
      VOCABULARY
    );
    expect(result.filters.incorporatedFrom).toBe("2020-01-01");
    expect(result.filters.incorporatedTo).toBe("2023-12-31");
  });

  it("ignores a date it cannot parse rather than inventing one", () => {
    const result = validateInterpretation(
      raw({ incorporatedFrom: "a few years ago" }),
      VOCABULARY
    );
    expect(result.filters.incorporatedFrom).toBeUndefined();
  });

  it("keeps only values that look like SIC codes", () => {
    const result = validateInterpretation(
      raw({ sicCodes: ["41201", "construction", "4110"] }),
      VOCABULARY
    );
    expect(result.filters.sicCodes).toEqual(["41201", "4110"]);
    expect(result.dropped).toEqual(['SIC code “construction”']);
  });

  it("passes through what the model could not express as a filter", () => {
    const result = validateInterpretation(
      raw({ keywords: "engineering", unresolved: ["fastest growing", "over 50 employees"] }),
      VOCABULARY
    );
    expect(result.unresolved).toEqual(["fastest growing", "over 50 employees"]);
  });

  it("falls back to a non-default sort only when it is a real sort order", () => {
    expect(validateInterpretation(raw({ sort: "newest" }), VOCABULARY).filters.sort).toBe("newest");

    const bogus = validateInterpretation(raw({ sort: "most profitable" }), VOCABULARY);
    expect(bogus.filters.sort).toBe("relevance");
    expect(bogus.dropped).toEqual(['sort “most profitable”']);
  });

  it("always produces filters the ordinary search schema accepts", () => {
    const result = validateInterpretation(
      raw({
        region: "SOUTH_WALES",
        localAuthority: "cardiff",
        statuses: ["ACTIVE"],
        sizeBands: ["small"],
        keywords: "solar",
      }),
      VOCABULARY
    );
    // welshOnly is the schema default, which proves the result went through it.
    expect(result.filters.welshOnly).toBe(true);
  });
});

describe("isEmptyInterpretation", () => {
  it("is true when the phrase produced nothing usable", () => {
    expect(isEmptyInterpretation(validateInterpretation(raw(), VOCABULARY))).toBe(true);
  });

  it("is false once any filter or keyword survived", () => {
    expect(
      isEmptyInterpretation(validateInterpretation(raw({ keywords: "solar" }), VOCABULARY))
    ).toBe(false);
    expect(
      isEmptyInterpretation(validateInterpretation(raw({ region: "MID_WALES" }), VOCABULARY))
    ).toBe(false);
  });
});

describe("interpretationSchema", () => {
  it("has no free-text field the model could assert a fact in", () => {
    // Every string field is either a filter value, a keyword for full-text
    // search, or the user's own words echoed back as unresolved. None of them
    // is a place the model could state something about a company.
    expect(Object.keys(interpretationSchema.shape).sort()).toEqual([
      "incorporatedFrom",
      "incorporatedTo",
      "keywords",
      "localAuthority",
      "postcode",
      "region",
      "sicCodes",
      "sizeBands",
      "sort",
      "statuses",
      "town",
      "unresolved",
    ]);
  });

  it("rejects a response carrying an extra field", () => {
    const parsed = interpretationSchema.safeParse({ ...raw(), summary: "There are 412 firms." });
    // Zod strips unknown keys rather than surfacing them, which is the point:
    // an extra field can never reach the caller.
    expect(parsed.success).toBe(true);
    expect(parsed.success && "summary" in parsed.data).toBe(false);
  });
});

describe("buildSystemPrompt", () => {
  it("lists only real authorities, regions and statuses", () => {
    const prompt = buildSystemPrompt(VOCABULARY);
    expect(prompt).toContain("isle-of-anglesey");
    expect(prompt).toContain("SOUTH_EAST_WALES");
    expect(prompt).toContain("never state a fact");
  });
});
