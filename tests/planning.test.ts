import { describe, expect, it } from "vitest";

import { readPlanningConfig, UNSUPPORTED_ADAPTERS } from "@/lib/sources/planning/config";
import {
  mapCategory,
  mapStatus,
  normalisePlanningRecord,
  readDate,
  readNumber,
  readString,
} from "@/lib/sources/planning/normalise";

const BASE_CONFIG = {
  endpoint: "https://example.gov.wales/arcgis/rest/services/planning/FeatureServer/0/query",
  fieldMap: {
    reference: "REFVAL",
    siteAddress: "LOCATION",
    postcode: "POSTCODE",
    description: "PROPOSAL",
    applicationType: "APPTYPE",
    status: "STATUS",
    decidedOn: "DECDATE",
    submittedOn: "RECDATE",
    applicantName: "APPLICANT",
    easting: "EASTING",
    northing: "NORTHING",
  },
  statusMap: { "decided - approved": "APPROVED", "pending consideration": "PENDING" },
  recordUrlTemplate: "https://example.gov.wales/planning/{reference}",
};

function config(overrides: Record<string, unknown> = {}) {
  const check = readPlanningConfig("arcgis_feature_server", { ...BASE_CONFIG, ...overrides });
  if (!check.ok) throw new Error(check.reason);
  return check.config;
}

describe("readPlanningConfig", () => {
  it("accepts a complete configuration", () => {
    const check = readPlanningConfig("arcgis_feature_server", BASE_CONFIG);
    expect(check.ok).toBe(true);
  });

  it("reports an authority with no adapter chosen", () => {
    const check = readPlanningConfig(null, {});
    expect(check).toEqual({ ok: false, reason: "No adapter has been chosen for this authority." });
  });

  it("explains why an HTML-only portal is not supported", () => {
    const check = readPlanningConfig("idox_html", {});
    expect(check.ok).toBe(false);
    expect(check.ok === false && check.reason).toBe(UNSUPPORTED_ADAPTERS.idox_html);
    expect(check.ok === false && check.reason).toContain("scraping the portal is not something we do");
  });

  it("rejects an unknown adapter rather than guessing", () => {
    const check = readPlanningConfig("some_new_portal", BASE_CONFIG);
    expect(check.ok).toBe(false);
    expect(check.ok === false && check.reason).toContain("Unknown planning adapter");
  });

  it("names the missing field when configuration is incomplete", () => {
    const check = readPlanningConfig("arcgis_feature_server", {
      endpoint: "https://example.gov.wales/x",
    });
    expect(check.ok).toBe(false);
    expect(check.ok === false && check.reason).toContain("fieldMap");
  });

  it("refuses a plaintext endpoint", () => {
    const check = readPlanningConfig("arcgis_feature_server", {
      ...BASE_CONFIG,
      endpoint: "http://example.gov.wales/x",
    });
    expect(check.ok).toBe(false);
  });

  it("requires a resource id for a CKAN datastore", () => {
    const withoutResource = readPlanningConfig("ckan_datastore", BASE_CONFIG);
    expect(withoutResource.ok).toBe(false);
    expect(withoutResource.ok === false && withoutResource.reason).toContain("resourceId");

    const withResource = readPlanningConfig("ckan_datastore", {
      ...BASE_CONFIG,
      resourceId: "abc-123",
    });
    expect(withResource.ok).toBe(true);
  });
});

describe("field readers", () => {
  it("reads a nested path", () => {
    expect(readString({ geometry: { x: "319000" } }, "geometry.x")).toBe("319000");
  });

  it("returns null for a blank or absent value rather than an empty string", () => {
    expect(readString({ a: "   " }, "a")).toBeNull();
    expect(readString({}, "a")).toBeNull();
    expect(readString({ a: null }, "a")).toBeNull();
  });

  it("reads a number published as a string with separators", () => {
    expect(readNumber({ n: "1,250" }, "n")).toBe(1250);
    expect(readNumber({ n: 42 }, "n")).toBe(42);
    expect(readNumber({ n: "not a number" }, "n")).toBeNull();
  });
});

describe("readDate", () => {
  it("reads an ISO date", () => {
    expect(readDate({ d: "2026-04-01" }, "d")?.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("reads epoch milliseconds, which ArcGIS publishes", () => {
    expect(readDate({ d: 1775001600000 }, "d")?.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("reads the UK day-first form", () => {
    expect(readDate({ d: "01/04/2026" }, "d")?.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("rejects an impossible UK date instead of rolling it over", () => {
    // 31 February would otherwise silently become 3 March.
    expect(readDate({ d: "31/02/2026" }, "d")).toBeNull();
  });

  it("returns null for anything it cannot parse", () => {
    expect(readDate({ d: "last Tuesday" }, "d")).toBeNull();
    expect(readDate({ d: "" }, "d")).toBeNull();
    expect(readDate({}, "d")).toBeNull();
  });
});

describe("mapStatus", () => {
  it("uses the authority's own mapping", () => {
    expect(mapStatus("Decided - Approved", { "decided - approved": "APPROVED" })).toBe("APPROVED");
  });

  it("accepts an authority that already publishes our vocabulary", () => {
    expect(mapStatus("WITHDRAWN", {})).toBe("WITHDRAWN");
    expect(mapStatus("under consideration", {})).toBe("UNDER_CONSIDERATION");
  });

  it("returns UNKNOWN for a word it has no mapping for, rather than guessing", () => {
    expect(mapStatus("Awaiting committee", {})).toBe("UNKNOWN");
    expect(mapStatus(null, {})).toBe("UNKNOWN");
  });

  it("ignores a mapping onto a status that does not exist", () => {
    expect(mapStatus("x", { x: "PROBABLY_APPROVED" })).toBe("UNKNOWN");
  });
});

describe("mapCategory", () => {
  it("maps through the authority's own vocabulary", () => {
    expect(mapCategory("Full - Householder", { "full - householder": "RESIDENTIAL" })).toBe(
      "RESIDENTIAL"
    );
  });

  it("returns UNKNOWN rather than inferring a category from free text", () => {
    expect(mapCategory("Erection of a dwelling", {})).toBe("UNKNOWN");
  });
});

describe("normalisePlanningRecord", () => {
  it("maps a record through the field map", () => {
    const result = normalisePlanningRecord(
      {
        REFVAL: "24/0123/FUL",
        LOCATION: "Land at Heol y Bryn",
        POSTCODE: "cf831aa",
        PROPOSAL: "Erection of 12 dwellings",
        APPTYPE: "Full",
        STATUS: "Pending consideration",
        RECDATE: "01/04/2026",
        APPLICANT: "Example Homes Ltd",
      },
      config()
    )!;

    expect(result.reference).toBe("24/0123/FUL");
    expect(result.siteAddress).toBe("Land at Heol y Bryn");
    expect(result.postcode).toBe("CF83 1AA");
    expect(result.status).toBe("PENDING");
    expect(result.submittedOn?.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(result.applicantName).toBe("Example Homes Ltd");
  });

  it("rejects a record with no authority reference, which has no identity", () => {
    expect(normalisePlanningRecord({ LOCATION: "Somewhere" }, config())).toBeNull();
  });

  it("leaves an unpublished field null rather than filling it in", () => {
    const result = normalisePlanningRecord({ REFVAL: "24/0001/FUL" }, config())!;
    expect(result.description).toBeNull();
    expect(result.decidedOn).toBeNull();
    expect(result.applicantName).toBeNull();
    expect(result.dwellingCount).toBeNull();
    expect(result.status).toBe("UNKNOWN");
  });

  it("converts a grid reference to coordinates", () => {
    const result = normalisePlanningRecord(
      { REFVAL: "24/0002/FUL", EASTING: 318174, NORTHING: 176439 },
      config()
    )!;
    expect(result.latitude).toBeCloseTo(51.482, 2);
    expect(result.longitude).toBeCloseTo(-3.181, 2);
    expect(result.easting).toBe(318174);
  });

  it("prefers published coordinates over a grid reference", () => {
    const withLatLng = config({
      fieldMap: { ...BASE_CONFIG.fieldMap, latitude: "LAT", longitude: "LON" },
    });
    const result = normalisePlanningRecord(
      { REFVAL: "24/0003/FUL", LAT: 52.5, LON: -3.5, EASTING: 318174, NORTHING: 176439 },
      withLatLng
    )!;
    expect(result.latitude).toBe(52.5);
    expect(result.longitude).toBe(-3.5);
  });

  it("drops a coordinate that is out of range rather than plotting it", () => {
    const withLatLng = config({
      fieldMap: { ...BASE_CONFIG.fieldMap, latitude: "LAT", longitude: "LON" },
    });
    const result = normalisePlanningRecord(
      { REFVAL: "24/0004/FUL", LAT: 999, LON: -3.5 },
      withLatLng
    )!;
    expect(result.latitude).toBeNull();
  });

  it("builds the record URL from the template", () => {
    const result = normalisePlanningRecord({ REFVAL: "24/0005/FUL" }, config())!;
    expect(result.sourceUrl).toBe("https://example.gov.wales/planning/24%2F0005%2FFUL");
  });

  it("prefers a URL the authority published itself", () => {
    const withUrl = config({ fieldMap: { ...BASE_CONFIG.fieldMap, url: "LINK" } });
    const result = normalisePlanningRecord(
      { REFVAL: "24/0006/FUL", LINK: "https://example.gov.wales/apps/24-0006" },
      withUrl
    )!;
    expect(result.sourceUrl).toBe("https://example.gov.wales/apps/24-0006");
  });

  it("normalises the applicant name for entity resolution", () => {
    const result = normalisePlanningRecord(
      { REFVAL: "24/0007/FUL", APPLICANT: "  Example   Homes Ltd  " },
      config()
    )!;
    expect(result.applicantNormalisedName).toBeTruthy();
    expect(result.applicantNormalisedName).not.toContain("  ");
  });
});
