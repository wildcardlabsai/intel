import { describe, expect, it } from "vitest";

import {
  deriveSizeBand,
  mapCompanyStatus,
  normaliseAddress,
  normaliseCharge,
  normaliseCompanyProfile,
  normaliseFiling,
  normaliseOfficer,
  normalisePsc,
  parseChDate,
} from "@/lib/sources/companies-house/normalise";
import type { ChCompanyProfile } from "@/lib/sources/companies-house/types";

describe("mapCompanyStatus", () => {
  it("maps the documented Companies House statuses", () => {
    expect(mapCompanyStatus("active")).toBe("ACTIVE");
    expect(mapCompanyStatus("dissolved")).toBe("DISSOLVED");
    expect(mapCompanyStatus("liquidation")).toBe("LIQUIDATION");
    expect(mapCompanyStatus("voluntary-arrangement")).toBe("VOLUNTARY_ARRANGEMENT");
  });

  it("falls back to UNKNOWN rather than guessing", () => {
    expect(mapCompanyStatus("something-new")).toBe("UNKNOWN");
    expect(mapCompanyStatus(undefined)).toBe("UNKNOWN");
  });
});

describe("parseChDate", () => {
  it("parses the documented YYYY-MM-DD format as UTC", () => {
    const date = parseChDate("2018-05-14");
    expect(date?.toISOString()).toBe("2018-05-14T00:00:00.000Z");
  });

  it("drops malformed dates instead of coercing them", () => {
    expect(parseChDate("14/05/2018")).toBeNull();
    expect(parseChDate("not a date")).toBeNull();
    expect(parseChDate("")).toBeNull();
    expect(parseChDate(undefined)).toBeNull();
  });
});

describe("deriveSizeBand", () => {
  it("derives a band from the accounts type", () => {
    expect(deriveSizeBand("micro-entity")).toBe("micro");
    expect(deriveSizeBand("small")).toBe("small");
    expect(deriveSizeBand("medium")).toBe("medium");
    expect(deriveSizeBand("dormant")).toBe("dormant");
    expect(deriveSizeBand("group")).toBe("large");
  });

  it("returns null when the accounts type implies no size", () => {
    expect(deriveSizeBand(undefined)).toBeNull();
    expect(deriveSizeBand("null")).toBeNull();
  });
});

describe("normaliseAddress", () => {
  it("normalises the postcode and keeps every component", () => {
    const address = normaliseAddress(
      {
        premises: "12",
        address_line_1: "High Street",
        locality: "Cardiff",
        region: "South Glamorgan",
        postal_code: "cf101ep",
        country: "Wales",
      },
      "REGISTERED_OFFICE"
    );
    expect(address).not.toBeNull();
    expect(address?.postcode).toBe("CF10 1EP");
    expect(address?.locality).toBe("Cardiff");
    expect(address?.type).toBe("REGISTERED_OFFICE");
  });

  it("returns null for an empty address", () => {
    expect(normaliseAddress(undefined, "REGISTERED_OFFICE")).toBeNull();
    expect(normaliseAddress({}, "REGISTERED_OFFICE")).toBeNull();
  });
});

describe("normaliseCompanyProfile", () => {
  const profile: ChCompanyProfile = {
    company_number: "01234567",
    company_name: "ABC Manufacturing Ltd",
    company_status: "active",
    type: "ltd",
    jurisdiction: "england-wales",
    date_of_creation: "2018-03-01",
    sic_codes: ["25620", "28990"],
    has_charges: true,
    has_insolvency_history: false,
    registered_office_address: {
      address_line_1: "Unit 4 Industrial Estate",
      locality: "Newport",
      postal_code: "NP20 1AA",
      country: "Wales",
    },
    accounts: { last_accounts: { made_up_to: "2024-03-31", type: "small" }, next_due: "2025-12-31" },
    previous_company_names: [{ name: "ABC Fabrication Ltd", effective_from: "2018-03-01" }],
  };

  it("maps a full profile", () => {
    const result = normaliseCompanyProfile(profile);
    expect(result.companyNumber).toBe("01234567");
    expect(result.name).toBe("ABC Manufacturing Ltd");
    expect(result.normalisedName).toBe("ABC MANUFACTURING");
    expect(result.status).toBe("ACTIVE");
    expect(result.sicCodes).toEqual(["25620", "28990"]);
    expect(result.sizeBand).toBe("small");
    expect(result.hasCharges).toBe(true);
    expect(result.previousNames).toEqual(["ABC Fabrication Ltd"]);
    expect(result.registeredOffice?.postcode).toBe("NP20 1AA");
    expect(result.incorporatedOn?.toISOString()).toBe("2018-03-01T00:00:00.000Z");
  });

  it("refuses a profile with no company number", () => {
    expect(() => normaliseCompanyProfile({ company_name: "X Ltd" })).toThrow(/company_number/);
  });

  it("refuses a profile with no name", () => {
    expect(() => normaliseCompanyProfile({ company_number: "01234567" })).toThrow(/company_name/);
  });

  it("copes with a minimal profile", () => {
    const result = normaliseCompanyProfile({ company_number: "SC123456", company_name: "Minimal Ltd" });
    expect(result.status).toBe("UNKNOWN");
    expect(result.sicCodes).toEqual([]);
    expect(result.registeredOffice).toBeNull();
    expect(result.incorporatedOn).toBeNull();
  });
});

describe("normaliseOfficer", () => {
  it("maps an active appointment", () => {
    const officer = normaliseOfficer(
      {
        name: "DAVIES, Catrin",
        officer_role: "director",
        appointed_on: "2020-01-15",
        nationality: "Welsh",
        date_of_birth: { month: 4, year: 1980 },
        links: { self: "/company/01234567/appointments/abc" },
      },
      0
    );
    expect(officer.sourceId).toBe("/company/01234567/appointments/abc");
    expect(officer.normalisedName).toBe("CATRIN DAVIES");
    expect(officer.isActive).toBe(true);
    expect(officer.dobYear).toBe(1980);
  });

  it("marks a resigned appointment inactive", () => {
    const officer = normaliseOfficer(
      { name: "JONES, Huw", officer_role: "director", appointed_on: "2015-01-01", resigned_on: "2022-06-30" },
      1
    );
    expect(officer.isActive).toBe(false);
    expect(officer.resignedOn?.toISOString()).toBe("2022-06-30T00:00:00.000Z");
  });

  it("builds a deterministic id when the API gives no link", () => {
    const first = normaliseOfficer({ name: "JONES, Huw", officer_role: "director", appointed_on: "2015-01-01" }, 0);
    const second = normaliseOfficer({ name: "JONES, Huw", officer_role: "director", appointed_on: "2015-01-01" }, 0);
    expect(first.sourceId).toBe(second.sourceId);
  });
});

describe("normalisePsc", () => {
  it("normalises a corporate PSC as a company name and keeps its number", () => {
    const psc = normalisePsc(
      {
        name: "Holdings Group Limited",
        kind: "corporate-entity-person-with-significant-control",
        natures_of_control: ["ownership-of-shares-75-to-100-percent"],
        notified_on: "2019-04-01",
        identification: { registration_number: "07654321" },
      },
      0
    );
    expect(psc.normalisedName).toBe("HOLDINGS GROUP");
    expect(psc.pscCompanyNumber).toBe("07654321");
    expect(psc.isActive).toBe(true);
  });

  it("normalises an individual PSC as a person name", () => {
    const psc = normalisePsc(
      { name: "Mr Gareth Evans", kind: "individual-person-with-significant-control", notified_on: "2019-04-01" },
      0
    );
    expect(psc.normalisedName).toBe("GARETH EVANS");
  });
});

describe("normaliseFiling", () => {
  it("maps a filing", () => {
    const filing = normaliseFiling({
      transaction_id: "MzM1",
      category: "accounts",
      type: "AA",
      description: "accounts-with-accounts-type-small",
      date: "2024-09-30",
      pages: 12,
    });
    expect(filing?.transactionId).toBe("MzM1");
    expect(filing?.date?.toISOString()).toBe("2024-09-30T00:00:00.000Z");
  });

  it("joins an array subcategory", () => {
    const filing = normaliseFiling({ transaction_id: "X", subcategory: ["resolution", "capital"] });
    expect(filing?.subcategory).toBe("resolution, capital");
  });

  it("drops a filing with no transaction id", () => {
    expect(normaliseFiling({ category: "accounts" })).toBeNull();
  });
});

describe("normaliseCharge", () => {
  it("maps a charge with persons entitled", () => {
    const charge = normaliseCharge(
      {
        id: "abc",
        charge_code: "012345670001",
        status: "outstanding",
        created_on: "2021-02-01",
        persons_entitled: [{ name: "Development Bank of Wales" }],
        classification: { description: "A registered charge" },
      },
      0
    );
    expect(charge.chargeId).toBe("abc");
    expect(charge.personsEntitled).toEqual(["Development Bank of Wales"]);
    expect(charge.classification).toBe("A registered charge");
  });

  it("falls back to an index when the charge has no id", () => {
    expect(normaliseCharge({}, 3).chargeId).toBe("3");
  });
});
