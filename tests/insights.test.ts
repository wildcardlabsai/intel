import { describe, expect, it } from "vitest";

import { escapeHtml, renderMarkdown } from "@/lib/insights/markdown";
import {
  blocksPublication,
  extractPlaceholders,
  parseStoredMetrics,
  renderTemplate,
  validateTemplate,
  type ResolvedMetric,
} from "@/lib/insights/template";

function metric(overrides: Partial<ResolvedMetric> = {}): ResolvedMetric {
  return {
    key: "companies_active",
    label: "Active Welsh companies",
    formatted: "132,481",
    value: 132481,
    query: "Count of companies where is_welsh = true and status = 'ACTIVE'.",
    computedAt: "2026-09-20T09:00:00.000Z",
    ...overrides,
  };
}

describe("extractPlaceholders", () => {
  it("finds each distinct metric key once, in order of first use", () => {
    const body = "{{a}} then {{b}} then {{a}} again";
    expect(extractPlaceholders(body)).toEqual(["a", "b"]);
  });

  it("tolerates whitespace and casing inside the braces", () => {
    expect(extractPlaceholders("{{ Companies_Active }}")).toEqual(["companies_active"]);
  });

  it("finds nothing in a body with no placeholders", () => {
    expect(extractPlaceholders("Plain prose with no figures.")).toEqual([]);
  });

  it("does not treat a single brace as a placeholder", () => {
    expect(extractPlaceholders("{companies_active}")).toEqual([]);
  });
});

describe("validateTemplate", () => {
  it("passes when every placeholder has a metric behind it", () => {
    expect(validateTemplate("{{a}} and {{b}}", ["a", "b"])).toEqual([]);
  });

  it("reports a placeholder with no metric, which blocks publication", () => {
    const issues = validateTemplate("Wales has {{made_up_number}} firms.", ["a"]);
    expect(issues).toContainEqual({ type: "undefined_metric", key: "made_up_number" });
    expect(blocksPublication(issues)).toBe(true);
  });

  it("reports an unused metric as a warning, not a blocker", () => {
    const issues = validateTemplate("No figures here.", ["companies_active"]);
    expect(issues).toEqual([{ type: "unused_metric", key: "companies_active" }]);
    expect(blocksPublication(issues)).toBe(false);
  });
});

describe("renderTemplate", () => {
  it("substitutes the computed figure", () => {
    expect(renderTemplate("Wales has {{companies_active}} firms.", [metric()])).toBe(
      "Wales has 132,481 firms."
    );
  });

  it("makes a missing figure visible rather than silently dropping it", () => {
    // A number quietly vanishing from a sentence is worse than an obvious gap.
    expect(renderTemplate("Wales has {{missing}} firms.", [])).toBe(
      "Wales has [figure unavailable] firms."
    );
  });

  it("substitutes every occurrence of the same key", () => {
    expect(renderTemplate("{{companies_active}} / {{companies_active}}", [metric()])).toBe(
      "132,481 / 132,481"
    );
  });
});

describe("parseStoredMetrics", () => {
  it("reads back what was stored", () => {
    expect(parseStoredMetrics([metric()])).toHaveLength(1);
  });

  it("returns nothing for a malformed record rather than throwing", () => {
    expect(parseStoredMetrics(null)).toEqual([]);
    expect(parseStoredMetrics([{ key: "a" }])).toEqual([]);
    expect(parseStoredMetrics("not an array")).toEqual([]);
  });
});

describe("renderMarkdown", () => {
  it("renders paragraphs, headings and lists", () => {
    const html = renderMarkdown("## Heading\n\nSome prose.\n\n- one\n- two");
    expect(html).toContain("<h2");
    expect(html).toContain("Heading");
    expect(html).toContain("<p");
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
  });

  it("renders ordered lists separately from bullets", () => {
    expect(renderMarkdown("1. first\n2. second")).toContain("<ol");
  });

  it("renders bold, italic and inline code", () => {
    const html = renderMarkdown("**bold** and *italic* and `code`");
    expect(html).toContain("<strong");
    expect(html).toContain("<em>");
    expect(html).toContain("<code");
  });

  it("escapes author HTML instead of rendering it", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes an attribute-breaking quote", () => {
    const html = renderMarkdown('He said "hello" and it\'s fine');
    expect(html).toContain("&quot;");
    expect(html).toContain("&#39;");
  });

  it("renders an http link", () => {
    const html = renderMarkdown("[Companies House](https://find-and-update.company-information.service.gov.uk)");
    expect(html).toContain('<a href="https://find-and-update.company-information.service.gov.uk"');
    expect(html).toContain("Companies House");
  });

  it("refuses a javascript: link, keeping only its text", () => {
    const html = renderMarkdown("[click me](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<a href");
    expect(html).toContain("click me");
  });

  it("refuses a data: link", () => {
    const html = renderMarkdown("[x](data:text/html;base64,PHNjcmlwdD4=)");
    expect(html).not.toContain("<a href");
  });

  it("refuses a relative link, which could otherwise be a protocol trick", () => {
    expect(renderMarkdown("[x](/dashboard)")).not.toContain("<a href");
  });

  it("allows a mailto link", () => {
    expect(renderMarkdown("[email](mailto:hello@example.com)")).toContain(
      '<a href="mailto:hello@example.com"'
    );
  });

  it("cannot be made to emit a tag from an image or iframe", () => {
    const html = renderMarkdown('![alt](x) <img src=x onerror=alert(1)> <iframe src="x"></iframe>');
    expect(html).not.toMatch(/<(img|iframe)/);
  });

  it("returns an empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown("\n\n")).toBe("");
  });
});

describe("escapeHtml", () => {
  it("escapes every character that could open a tag or break an attribute", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});
