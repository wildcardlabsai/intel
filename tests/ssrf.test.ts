import { describe, expect, it } from "vitest";

import {
  blockedAddressReason,
  blockedHostnameReason,
  checkUrlShape,
} from "@/lib/http/ssrf";
import { readPlanningConfig } from "@/lib/sources/planning/config";

describe("blockedAddressReason", () => {
  it("blocks cloud instance metadata", () => {
    expect(blockedAddressReason("169.254.169.254")).toContain("link-local");
  });

  it("blocks loopback", () => {
    expect(blockedAddressReason("127.0.0.1")).toContain("loopback");
    expect(blockedAddressReason("127.1.2.3")).toContain("loopback");
    expect(blockedAddressReason("::1")).toContain("loopback");
  });

  it("blocks every private IPv4 range", () => {
    expect(blockedAddressReason("10.0.0.1")).toContain("private");
    expect(blockedAddressReason("172.16.0.1")).toContain("private");
    expect(blockedAddressReason("172.31.255.255")).toContain("private");
    expect(blockedAddressReason("192.168.1.1")).toContain("private");
  });

  it("does not over-block the parts of 172 that are public", () => {
    expect(blockedAddressReason("172.15.0.1")).toBeNull();
    expect(blockedAddressReason("172.32.0.1")).toBeNull();
  });

  it("blocks unspecified, CGNAT and multicast space", () => {
    expect(blockedAddressReason("0.0.0.0")).toContain("unspecified");
    expect(blockedAddressReason("100.64.0.1")).toContain("carrier-grade");
    expect(blockedAddressReason("224.0.0.1")).toContain("multicast");
  });

  it("blocks IPv6 private and link-local space", () => {
    expect(blockedAddressReason("fd00::1")).toContain("private");
    expect(blockedAddressReason("fe80::1")).toContain("link-local");
    expect(blockedAddressReason("ff02::1")).toContain("multicast");
  });

  it("blocks an IPv4 address smuggled inside IPv6", () => {
    // ::ffff:169.254.169.254 is metadata wearing a different hat.
    expect(blockedAddressReason("::ffff:169.254.169.254")).toContain("link-local");
    expect(blockedAddressReason("::ffff:127.0.0.1")).toContain("loopback");
  });

  it("allows ordinary public addresses", () => {
    expect(blockedAddressReason("93.184.216.34")).toBeNull();
    expect(blockedAddressReason("2606:2800:220:1:248:1893:25c8:1946")).toBeNull();
  });
});

describe("blockedHostnameReason", () => {
  it("blocks localhost and internal suffixes", () => {
    expect(blockedHostnameReason("localhost")).toBe("localhost");
    expect(blockedHostnameReason("db.internal")).toContain("internal");
    expect(blockedHostnameReason("printer.local")).toContain("internal");
  });

  it("blocks a single-label hostname, which resolves through search domains", () => {
    expect(blockedHostnameReason("intranet")).toContain("no domain");
  });

  it("blocks a bare IP, which would skip the DNS check entirely", () => {
    expect(blockedHostnameReason("93.184.216.34")).toContain("bare IP");
    expect(blockedHostnameReason("169.254.169.254")).toContain("link-local");
  });

  it("ignores a trailing dot used to bypass suffix matching", () => {
    expect(blockedHostnameReason("localhost.")).toBe("localhost");
  });

  it("is case-insensitive", () => {
    expect(blockedHostnameReason("LOCALHOST")).toBe("localhost");
    expect(blockedHostnameReason("DB.Internal")).toContain("internal");
  });

  it("allows a real council hostname", () => {
    expect(blockedHostnameReason("maps.caerphilly.gov.uk")).toBeNull();
    expect(blockedHostnameReason("datamap.gov.wales")).toBeNull();
  });
});

describe("checkUrlShape", () => {
  it("accepts an ordinary https endpoint", () => {
    expect(
      checkUrlShape("https://maps.example.gov.wales/arcgis/rest/services/P/FeatureServer/0/query")
    ).toEqual({ ok: true });
  });

  it("refuses anything that is not https", () => {
    expect(checkUrlShape("http://maps.example.gov.wales/x").ok).toBe(false);
    expect(checkUrlShape("file:///etc/passwd").ok).toBe(false);
    expect(checkUrlShape("gopher://example.com/").ok).toBe(false);
  });

  it("refuses credentials embedded in the URL", () => {
    const result = checkUrlShape("https://user:secret@example.gov.wales/x");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("credentials");
  });

  it("refuses an https URL pointing at instance metadata", () => {
    const result = checkUrlShape("https://169.254.169.254/latest/meta-data/");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("link-local");
  });

  it("refuses an https URL pointing at an internal service", () => {
    expect(checkUrlShape("https://10.0.0.5:9200/_search").ok).toBe(false);
    expect(checkUrlShape("https://localhost:5432/").ok).toBe(false);
  });

  it("refuses a malformed URL rather than throwing", () => {
    expect(checkUrlShape("not a url").ok).toBe(false);
    expect(checkUrlShape("").ok).toBe(false);
  });
});

describe("planning configuration rejects unsafe endpoints", () => {
  const fieldMap = { reference: "REF" };

  it("refuses to store an endpoint pointing at instance metadata", () => {
    const check = readPlanningConfig("arcgis_feature_server", {
      endpoint: "https://169.254.169.254/latest/meta-data/",
      fieldMap,
    });
    expect(check.ok).toBe(false);
    expect(check.ok === false && check.reason).toContain("link-local");
  });

  it("refuses to store an endpoint pointing at localhost", () => {
    const check = readPlanningConfig("arcgis_feature_server", {
      endpoint: "https://localhost/query",
      fieldMap,
    });
    expect(check.ok).toBe(false);
  });

  it("still accepts a genuine public endpoint", () => {
    const check = readPlanningConfig("arcgis_feature_server", {
      endpoint: "https://maps.example.gov.wales/arcgis/rest/services/P/FeatureServer/0/query",
      fieldMap,
    });
    expect(check.ok).toBe(true);
  });
});
