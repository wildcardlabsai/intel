import { z } from "zod";

/**
 * Insight templating.
 *
 * An insight body never contains a hand-typed statistic. Where a figure
 * belongs, the author writes a placeholder naming a metric:
 *
 *     Wales has {{companies_active}} actively trading registered companies.
 *
 * At publish time every placeholder is resolved by running its metric against
 * the database, and the resulting value is stored alongside the query that
 * produced it. Publishing is refused if a placeholder names a metric the
 * insight does not define, so a figure can never appear without a query behind
 * it, and a published figure can always be re-derived later.
 *
 * Everything here is pure text handling; running the metrics lives in
 * `metrics.ts`.
 */

const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/** Every distinct metric key referenced by a body, in order of first use. */
export function extractPlaceholders(body: string): string[] {
  const found: string[] = [];
  for (const match of body.matchAll(PLACEHOLDER)) {
    const key = match[1]!.toLowerCase();
    if (!found.includes(key)) found.push(key);
  }
  return found;
}

export type ResolvedMetric = {
  key: string;
  label: string;
  /** The figure itself, already formatted for reading. */
  formatted: string;
  /** The raw value, kept so the figure can be checked numerically. */
  value: number;
  /** A description of exactly what was counted, for reproducibility. */
  query: string;
  computedAt: string;
};

export type TemplateIssue =
  | { type: "undefined_metric"; key: string }
  | { type: "unused_metric"; key: string };

/**
 * Checks a body against the metrics an insight defines.
 *
 * An undefined metric blocks publication: it would put a figure on the page
 * with nothing behind it. An unused metric is only a warning — it is dead
 * weight, not a correctness problem.
 */
export function validateTemplate(body: string, definedKeys: string[]): TemplateIssue[] {
  const used = extractPlaceholders(body);
  const issues: TemplateIssue[] = [];

  for (const key of used) {
    if (!definedKeys.includes(key)) issues.push({ type: "undefined_metric", key });
  }
  for (const key of definedKeys) {
    if (!used.includes(key)) issues.push({ type: "unused_metric", key });
  }

  return issues;
}

export function blocksPublication(issues: TemplateIssue[]): boolean {
  return issues.some((issue) => issue.type === "undefined_metric");
}

/**
 * Substitutes resolved figures into the body.
 *
 * A placeholder with no resolved metric renders as a visible marker rather
 * than silently disappearing or leaving raw braces on the page — a missing
 * figure should be obvious, not invisible.
 */
export function renderTemplate(body: string, metrics: ResolvedMetric[]): string {
  const byKey = new Map(metrics.map((metric) => [metric.key, metric]));
  return body.replace(PLACEHOLDER, (_match, rawKey: string) => {
    const metric = byKey.get(rawKey.toLowerCase());
    return metric ? metric.formatted : "[figure unavailable]";
  });
}

export const resolvedMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  formatted: z.string(),
  value: z.number(),
  query: z.string(),
  computedAt: z.string(),
});

export const resolvedMetricsSchema = z.array(resolvedMetricSchema);

/** Reads the stored metrics off an insight, tolerating older records. */
export function parseStoredMetrics(raw: unknown): ResolvedMetric[] {
  const parsed = resolvedMetricsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}
