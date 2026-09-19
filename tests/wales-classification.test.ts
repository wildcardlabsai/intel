import { describe, expect, it } from "vitest";

import {
  classifyCompanyLocation,
  classifyWelshLocation,
  normalisePostcode,
  parsePostcodeArea,
} from "@/lib/wales/classification";
import { findLocalAuthorityByName } from "@/lib/wales/local-authorities";

describe("postcode parsing", () => {
  it("extracts the postcode area", () => {
    expect(parsePostcodeArea("CF10 1EP")).toBe("CF");
    expect(parsePostcodeArea("ll57 2dg")).toBe("LL");
    expect(parsePostcodeArea("SA1 1AA")).toBe("SA");
  });

  it("returns null for anything that is not a UK postcode", () => {
    expect(parsePostcodeArea("not a postcode")).toBeNull();
    expect(parsePostcodeArea("")).toBeNull();
    expect(parsePostcodeArea(null)).toBeNull();
  });

  it("normalises spacing and case", () => {
    expect(normalisePostcode("cf101ep")).toBe("CF10 1EP");
    expect(normalisePostcode("  SA1   1AA ")).toBe("SA1 1AA");
  });
});

describe("classifyWelshLocation", () => {
  it("treats an ONS postcode lookup as authoritative", () => {
    const result = classifyWelshLocation({
      postcode: "CH5 3AA",
      postcodeLookup: {
        country: "Wales",
        localAuthority: "Flintshire",
        latitude: 53.2,
        longitude: -3.0,
      },
    });
    expect(result.isWelsh).toBe(true);
    expect(result.confidence).toBe("CONFIRMED");
    expect(result.localAuthoritySlug).toBe("flintshire");
    expect(result.region).toBe("NORTH_WALES");
  });

  it("rejects a record the postcode lookup says is in England", () => {
    const result = classifyWelshLocation({
      postcode: "CH1 1AA",
      postcodeLookup: { country: "England", localAuthority: "Cheshire West and Chester", latitude: 53.2, longitude: -2.9 },
    });
    expect(result.isWelsh).toBe(false);
    expect(result.confidence).toBe("NOT_WELSH");
  });

  it("confirms a wholly Welsh postcode area without a lookup", () => {
    const result = classifyWelshLocation({ postcode: "CF10 1EP", locality: "Cardiff" });
    expect(result.isWelsh).toBe(true);
    expect(result.confidence).toBe("CONFIRMED");
    expect(result.localAuthoritySlug).toBe("cardiff");
  });

  it("does not guess for a cross-border area without corroboration", () => {
    const result = classifyWelshLocation({ postcode: "SY1 1AA", locality: "Shrewsbury" });
    expect(result.isWelsh).toBe(false);
    expect(result.confidence).toBe("UNKNOWN");
    expect(result.needsPostcodeLookup).toBe(true);
  });

  it("marks a cross-border area as likely when the address names a Welsh authority", () => {
    const result = classifyWelshLocation({ postcode: "SY16 1AA", region: "Powys" });
    expect(result.isWelsh).toBe(true);
    expect(result.confidence).toBe("LIKELY");
    expect(result.localAuthoritySlug).toBe("powys");
    expect(result.needsPostcodeLookup).toBe(true);
  });

  it("rejects a postcode area outside Wales", () => {
    const result = classifyWelshLocation({ postcode: "BS1 4DJ", locality: "Bristol" });
    expect(result.isWelsh).toBe(false);
    expect(result.confidence).toBe("NOT_WELSH");
  });

  it("never treats a Welsh-sounding company name as evidence", () => {
    // The classifier has no access to the name at all — this asserts the
    // contract by showing a Bristol address is not Welsh regardless.
    const result = classifyWelshLocation({
      postcode: "BS1 4DJ",
      locality: "Bristol",
      region: "Avon",
      country: "England",
    });
    expect(result.isWelsh).toBe(false);
  });

  it("falls back to address text when there is no usable postcode", () => {
    const result = classifyWelshLocation({ locality: "Caerphilly" });
    expect(result.isWelsh).toBe(true);
    expect(result.confidence).toBe("LIKELY");
    expect(result.region).toBe("SOUTH_EAST_WALES");
  });

  it("returns UNKNOWN when there is no evidence either way", () => {
    const result = classifyWelshLocation({ locality: "Somewhere" });
    expect(result.confidence).toBe("UNKNOWN");
    expect(result.isWelsh).toBe(false);
  });

  it("always explains its decision", () => {
    const result = classifyWelshLocation({ postcode: "CF10 1EP" });
    expect(result.evidence.length).toBeGreaterThan(10);
  });
});

describe("classifyCompanyLocation", () => {
  it("prefers the registered office", () => {
    const result = classifyCompanyLocation(
      { postcode: "CF10 1EP", locality: "Cardiff" },
      [{ postcode: "BS1 4DJ", locality: "Bristol" }]
    );
    expect(result.confidence).toBe("CONFIRMED");
    expect(result.localAuthoritySlug).toBe("cardiff");
  });

  it("downgrades to POSSIBLE when only a secondary address is Welsh", () => {
    const result = classifyCompanyLocation(
      { locality: "Somewhere" },
      [{ postcode: "SA1 1AA", locality: "Swansea" }]
    );
    expect(result.isWelsh).toBe(true);
    expect(result.confidence).toBe("POSSIBLE");
  });

  it("does not rescue a company the registered office rules out", () => {
    const result = classifyCompanyLocation(
      { postcode: "BS1 4DJ", locality: "Bristol" },
      [{ postcode: "CF10 1EP", locality: "Cardiff" }]
    );
    expect(result.confidence).toBe("NOT_WELSH");
  });
});

describe("findLocalAuthorityByName", () => {
  it("matches canonical names", () => {
    expect(findLocalAuthorityByName("Cardiff")?.slug).toBe("cardiff");
  });

  it("matches Welsh-language names", () => {
    expect(findLocalAuthorityByName("Caerdydd")?.slug).toBe("cardiff");
    expect(findLocalAuthorityByName("Ynys Môn")?.slug).toBe("isle-of-anglesey");
  });

  it("ignores council suffixes", () => {
    expect(findLocalAuthorityByName("Cardiff Council")?.slug).toBe("cardiff");
    expect(findLocalAuthorityByName("Wrexham County Borough Council")?.slug).toBe("wrexham");
  });

  it("handles known aliases and spelling variants", () => {
    expect(findLocalAuthorityByName("Rhondda Cynon Taff")?.slug).toBe("rhondda-cynon-taf");
    expect(findLocalAuthorityByName("City and County of Swansea")?.slug).toBe("swansea");
  });

  it("returns null for authorities outside Wales", () => {
    expect(findLocalAuthorityByName("Bristol City Council")).toBeNull();
    expect(findLocalAuthorityByName(null)).toBeNull();
  });
});
