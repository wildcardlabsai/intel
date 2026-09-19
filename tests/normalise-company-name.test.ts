import { describe, expect, it } from "vitest";

import {
  companyNumberFromOcdsIdentifier,
  nameSimilarity,
  normaliseCompanyName,
  normaliseCompanyNumber,
  normalisePersonName,
} from "@/lib/normalise/company-name";

describe("normaliseCompanyName", () => {
  it("collapses the legal-form variants of the same company", () => {
    const variants = [
      "ABC Construction Ltd",
      "ABC CONSTRUCTION LIMITED",
      "A.B.C. Construction",
      "abc construction ltd.",
    ];
    const normalised = variants.map(normaliseCompanyName);
    expect(new Set(normalised).size).toBe(1);
    expect(normalised[0]).toBe("ABC CONSTRUCTION");
  });

  it("strips Welsh legal forms", () => {
    expect(normaliseCompanyName("Adeiladu Cymru Cyf")).toBe("ADEILADU CYMRU");
    expect(normaliseCompanyName("Gwynedd Cwmni Cyfyngedig")).toBe("GWYNEDD");
  });

  it("removes diacritics so Welsh spellings match", () => {
    expect(normaliseCompanyName("Llŷn Builders Ltd")).toBe("LLYN BUILDERS");
  });

  it("normalises ampersands consistently", () => {
    expect(normaliseCompanyName("Smith & Jones Ltd")).toBe(normaliseCompanyName("Smith and Jones Limited"));
  });

  it("drops a leading 'The'", () => {
    expect(normaliseCompanyName("The Welsh Bakery Ltd")).toBe("WELSH BAKERY");
  });

  it("removes trailing parenthetical notes", () => {
    expect(normaliseCompanyName("ABC Ltd (formerly XYZ Ltd)")).toBe("ABC");
  });

  it("strips repeated legal suffixes", () => {
    expect(normaliseCompanyName("ABC Limited Ltd")).toBe("ABC");
  });

  it("does not reduce a name to nothing when it is only a legal form", () => {
    expect(normaliseCompanyName("Limited")).toBe("LIMITED");
  });

  it("returns an empty string for empty input", () => {
    expect(normaliseCompanyName(null)).toBe("");
    expect(normaliseCompanyName("")).toBe("");
    expect(normaliseCompanyName("   ")).toBe("");
  });

  it("keeps genuinely different companies apart", () => {
    expect(normaliseCompanyName("ABC Construction Ltd")).not.toBe(
      normaliseCompanyName("ABC Consulting Ltd")
    );
  });
});

describe("normalisePersonName", () => {
  it("reorders surname-first names", () => {
    expect(normalisePersonName("SMITH, John Andrew")).toBe("JOHN ANDREW SMITH");
  });

  it("removes titles and honorifics", () => {
    expect(normalisePersonName("Dr Jane Davies OBE")).toBe("JANE DAVIES");
  });

  it("keeps apostrophised surnames as one token", () => {
    expect(normalisePersonName("Sean O'Brien")).toBe("SEAN OBRIEN");
  });
});

describe("nameSimilarity", () => {
  it("scores identical names as 1", () => {
    expect(nameSimilarity("ABC CONSTRUCTION", "ABC CONSTRUCTION")).toBe(1);
  });

  it("scores unrelated names near zero", () => {
    expect(nameSimilarity("ABC CONSTRUCTION", "ZZZ CATERING")).toBeLessThan(0.2);
  });

  it("rewards a prefix relationship", () => {
    const score = nameSimilarity("ABC CONSTRUCTION", "ABC CONSTRUCTION SERVICES");
    expect(score).toBeGreaterThan(0.6);
    expect(score).toBeLessThan(1);
  });

  it("is order independent", () => {
    expect(nameSimilarity("JONES AND SMITH", "SMITH AND JONES")).toBe(1);
  });

  it("returns 0 when either side is empty", () => {
    expect(nameSimilarity("", "ABC")).toBe(0);
  });
});

describe("normaliseCompanyNumber", () => {
  it("zero-pads short numeric numbers to eight digits", () => {
    expect(normaliseCompanyNumber("1234567")).toBe("01234567");
    expect(normaliseCompanyNumber("123")).toBe("00000123");
  });

  it("keeps eight-digit numbers unchanged", () => {
    expect(normaliseCompanyNumber("01234567")).toBe("01234567");
  });

  it("handles prefixed numbers such as Scottish and LLP registrations", () => {
    expect(normaliseCompanyNumber("SC123456")).toBe("SC123456");
    expect(normaliseCompanyNumber("sc1234")).toBe("SC001234");
    expect(normaliseCompanyNumber("OC 123456")).toBe("OC123456");
  });

  it("returns null rather than inventing an identifier", () => {
    expect(normaliseCompanyNumber("not a number")).toBeNull();
    expect(normaliseCompanyNumber("")).toBeNull();
    expect(normaliseCompanyNumber(null)).toBeNull();
    expect(normaliseCompanyNumber("123456789012")).toBeNull();
  });
});

describe("companyNumberFromOcdsIdentifier", () => {
  it("extracts the number from a GB-COH identifier", () => {
    expect(companyNumberFromOcdsIdentifier("GB-COH", "01234567")).toBe("01234567");
    expect(companyNumberFromOcdsIdentifier("GB-COH", "GB-COH-01234567")).toBe("01234567");
  });

  it("ignores identifiers from other schemes", () => {
    expect(companyNumberFromOcdsIdentifier("GB-CHC", "1234567")).toBeNull();
    expect(companyNumberFromOcdsIdentifier("VAT", "GB123456789")).toBeNull();
  });

  it("returns null when there is no identifier", () => {
    expect(companyNumberFromOcdsIdentifier("GB-COH", undefined)).toBeNull();
  });
});
