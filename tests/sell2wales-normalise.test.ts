import { describe, expect, it } from "vitest";

import {
  mapNoticeType,
  mapStatus,
  normaliseOrganisation,
  normaliseRelease,
  parseOcdsDate,
} from "@/lib/sources/sell2wales/normalise";
import type { OcdsRelease } from "@/lib/sources/sell2wales/types";

function release(overrides: Partial<OcdsRelease> = {}): OcdsRelease {
  return {
    ocid: "ocds-abc123-0001",
    id: "0001-2026-01-15",
    date: "2026-01-15T09:00:00Z",
    tag: ["tender"],
    tender: {
      id: "T-1",
      title: "Supply of IT services",
      description: "Provision of managed IT services",
      status: "active",
      value: { amount: 1_200_000, currency: "GBP" },
      tenderPeriod: { endDate: "2026-02-15T17:00:00Z" },
      classification: { scheme: "CPV", id: "72000000" },
      items: [
        {
          id: "1",
          deliveryAddresses: [{ locality: "Cardiff", postalCode: "CF10 1EP" }],
        },
      ],
    },
    buyer: { id: "GB-COH-01234567", name: "Example Council" },
    parties: [
      {
        id: "GB-COH-01234567",
        name: "Example Council",
        roles: ["buyer"],
        identifier: { scheme: "GB-COH", id: "01234567" },
        address: { locality: "Cardiff", postalCode: "CF10 1EP" },
      },
    ],
    ...overrides,
  };
}

describe("parseOcdsDate", () => {
  it("parses ISO 8601 timestamps", () => {
    expect(parseOcdsDate("2026-01-15T09:00:00Z")?.toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });

  it("drops unparseable values", () => {
    expect(parseOcdsDate("not a date")).toBeNull();
    expect(parseOcdsDate(undefined)).toBeNull();
  });
});

describe("mapNoticeType", () => {
  it("prefers the most specific tag", () => {
    expect(mapNoticeType(release({ tag: ["tender", "award"] }))).toBe("CONTRACT_AWARD");
    expect(mapNoticeType(release({ tag: ["tender"] }))).toBe("TENDER");
    expect(mapNoticeType(release({ tag: ["planning"] }))).toBe("PRIOR_INFORMATION");
  });

  it("falls back to the procurement method", () => {
    const value = release({
      tag: [],
      tender: { title: "X", procurementMethodDetails: "Framework agreement" },
    });
    expect(mapNoticeType(value)).toBe("FRAMEWORK");
  });

  it("returns UNKNOWN rather than guessing", () => {
    expect(mapNoticeType(release({ tag: [], tender: { title: "X" } }))).toBe("UNKNOWN");
  });
});

describe("mapStatus", () => {
  it("reports AWARDED when an active award is present", () => {
    const value = release({ awards: [{ id: "a1", status: "active", date: "2026-03-01" }] });
    expect(mapStatus(value)).toBe("AWARDED");
  });

  it("maps the tender status when there is no award", () => {
    expect(mapStatus(release())).toBe("ACTIVE");
    expect(
      mapStatus(release({ tender: { title: "X", status: "cancelled" } }))
    ).toBe("CANCELLED");
  });
});

describe("normaliseOrganisation", () => {
  it("extracts a Companies House number from the identifier", () => {
    const org = normaliseOrganisation(
      {
        id: "GB-COH-01234567",
        name: "ABC Construction Limited",
        identifier: { scheme: "GB-COH", id: "01234567" },
        address: { locality: "Newport", postalCode: "np201aa" },
        details: { scale: "sme" },
      },
      "fallback"
    );
    expect(org?.companyNumber).toBe("01234567");
    expect(org?.normalisedName).toBe("ABC CONSTRUCTION");
    expect(org?.postcode).toBe("NP20 1AA");
    expect(org?.isSme).toBe(true);
  });

  it("looks through additional identifiers for a company number", () => {
    const org = normaliseOrganisation(
      {
        id: "org-1",
        name: "ABC Ltd",
        identifier: { scheme: "VAT", id: "GB123456789" },
        additionalIdentifiers: [{ scheme: "GB-COH", id: "07654321" }],
      },
      "fallback"
    );
    expect(org?.companyNumber).toBe("07654321");
  });

  it("returns null when the organisation has no name", () => {
    expect(normaliseOrganisation({ id: "x" }, "fallback")).toBeNull();
    expect(normaliseOrganisation(undefined, "fallback")).toBeNull();
  });

  it("builds a deterministic id when the publisher gives none", () => {
    const a = normaliseOrganisation({ name: "ABC Ltd" }, "ocid-1");
    const b = normaliseOrganisation({ name: "ABC Limited" }, "ocid-1");
    expect(a?.sourceId).toBe(b?.sourceId);
  });
});

describe("normaliseRelease", () => {
  it("maps a tender release", () => {
    const notice = normaliseRelease(release());
    expect(notice.ocid).toBe("ocds-abc123-0001");
    expect(notice.title).toBe("Supply of IT services");
    expect(notice.type).toBe("TENDER");
    expect(notice.status).toBe("ACTIVE");
    expect(notice.valueAmount).toBe(1_200_000);
    expect(notice.valueCurrency).toBe("GBP");
    expect(notice.cpvCodes).toEqual(["72000000"]);
    expect(notice.deliveryLocality).toBe("Cardiff");
    expect(notice.postcode).toBe("CF10 1EP");
    expect(notice.buyer?.companyNumber).toBe("01234567");
    expect(notice.deadlineAt?.toISOString()).toBe("2026-02-15T17:00:00.000Z");
  });

  it("sums award values when the tender publishes no headline value", () => {
    const notice = normaliseRelease(
      release({
        tender: { title: "Works" },
        awards: [
          { id: "a1", status: "active", value: { amount: 100_000, currency: "GBP" }, date: "2026-03-01" },
          { id: "a2", status: "active", value: { amount: 50_000, currency: "GBP" }, date: "2026-03-01" },
        ],
      })
    );
    expect(notice.valueAmount).toBe(150_000);
  });

  it("leaves the value null when neither tender nor awards publish one", () => {
    const notice = normaliseRelease(release({ tender: { title: "Works" }, awards: [{ id: "a1" }] }));
    expect(notice.valueAmount).toBeNull();
  });

  it("resolves a buyer referenced by id in parties", () => {
    const notice = normaliseRelease(
      release({ buyer: { id: "GB-COH-01234567" } })
    );
    expect(notice.buyer?.name).toBe("Example Council");
    expect(notice.buyer?.postcode).toBe("CF10 1EP");
  });

  it("finds the buyer from parties roles when no buyer is given", () => {
    const notice = normaliseRelease(release({ buyer: undefined }));
    expect(notice.buyer?.name).toBe("Example Council");
  });

  it("collects suppliers from awards", () => {
    const notice = normaliseRelease(
      release({
        awards: [
          {
            id: "a1",
            status: "active",
            date: "2026-03-01",
            value: { amount: 250_000, currency: "GBP" },
            suppliers: [
              { id: "s1", name: "Valley Builders Ltd", identifier: { scheme: "GB-COH", id: "09876543" } },
            ],
          },
        ],
      })
    );
    expect(notice.awards).toHaveLength(1);
    expect(notice.awards[0].suppliers[0].companyNumber).toBe("09876543");
    expect(notice.awards[0].valueAmount).toBe(250_000);
  });

  it("deduplicates CPV codes across tender and items", () => {
    const notice = normaliseRelease(
      release({
        tender: {
          title: "X",
          classification: { scheme: "CPV", id: "45000000" },
          additionalClassifications: [{ scheme: "CPV", id: "45210000" }],
          items: [{ id: "1", classification: { scheme: "CPV", id: "45000000" } }],
        },
      })
    );
    expect(notice.cpvCodes.sort()).toEqual(["45000000", "45210000"]);
  });

  it("ignores classifications from other schemes", () => {
    const notice = normaliseRelease(
      release({ tender: { title: "X", classification: { scheme: "NUTS", id: "UKL" } } })
    );
    expect(notice.cpvCodes).toEqual([]);
  });

  it("refuses a release with no ocid", () => {
    expect(() => normaliseRelease({ tender: { title: "X" } })).toThrow(/ocid/);
  });

  it("refuses a release with no title", () => {
    expect(() => normaliseRelease({ ocid: "x", tender: {} })).toThrow(/title/);
  });
});
