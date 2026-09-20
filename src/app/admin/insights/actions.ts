"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getMetricDefinition, resolveMetrics, type MetricRequest } from "@/lib/insights/metrics";
import {
  blocksPublication,
  extractPlaceholders,
  validateTemplate,
} from "@/lib/insights/template";

/**
 * Insight authoring.
 *
 * The rule the whole feature exists to enforce: a figure never reaches a
 * published page unless a metric computed it. Publication is refused when the
 * body quotes a placeholder the insight does not define, or when a defined
 * metric fails to run.
 */

export type InsightResult = {
  ok: boolean;
  error?: string;
  message?: string;
  /** Problems the author must fix before this can be published. */
  issues?: string[];
  insightId?: string;
};

const metricRequestSchema = z.object({
  key: z.string().min(1).max(60),
  params: z.record(z.string(), z.string().max(40)).default({}),
});

const draftSchema = z.object({
  title: z.string().trim().min(3, "Give the insight a title").max(180),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens")
    .max(120),
  category: z.string().trim().min(2, "Choose a category").max(60),
  summary: z.string().trim().max(400).optional(),
  bodyMarkdown: z.string().trim().max(40_000).optional(),
  metrics: z.array(metricRequestSchema).max(20),
});

function parseMetrics(value: FormDataEntryValue | null): MetricRequest[] {
  if (typeof value !== "string" || value.trim().length === 0) return [];
  try {
    const parsed = z.array(metricRequestSchema).safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function readDraft(formData: FormData) {
  return draftSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    category: formData.get("category"),
    summary: formData.get("summary") || undefined,
    bodyMarkdown: formData.get("bodyMarkdown") || undefined,
    metrics: parseMetrics(formData.get("metrics")),
  });
}

export async function saveInsight(formData: FormData): Promise<InsightResult> {
  const admin = await requireAdmin();

  const parsed = readDraft(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const id = formData.get("id");
  const { title, slug, category, summary, bodyMarkdown, metrics } = parsed.data;

  // Every metric the author selected must actually exist in the registry.
  const unknown = metrics.filter((metric) => !getMetricDefinition(metric.key));
  if (unknown.length > 0) {
    return { ok: false, error: `Unknown metric: ${unknown.map((m) => m.key).join(", ")}.` };
  }

  const clash = await prisma.insight.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== id) {
    return { ok: false, error: "Another insight already uses that slug." };
  }

  const data = {
    title,
    slug,
    category,
    summary: summary ?? null,
    bodyMarkdown: bodyMarkdown ?? null,
    // `queries` keeps the metric selection; `metrics` holds resolved figures
    // and is only written at publish time.
    queries: metrics as never,
  };

  const insight =
    typeof id === "string" && id.length > 0
      ? await prisma.insight.update({ where: { id }, data })
      : await prisma.insight.create({ data: { ...data, authorUserId: admin.id } });

  revalidatePath("/admin/insights");
  revalidatePath(`/admin/insights/${insight.id}`);

  return { ok: true, message: "Draft saved.", insightId: insight.id };
}

/**
 * Publishes an insight, resolving every figure first.
 *
 * The resolved figures and the queries that produced them are stored on the
 * record, so the published page shows numbers that were computed at a known
 * moment and can be re-derived later.
 */
export async function publishInsight(insightId: string): Promise<InsightResult> {
  await requireAdmin();

  const insight = await prisma.insight.findUnique({ where: { id: insightId } });
  if (!insight) return { ok: false, error: "Insight not found." };

  const requests = (insight.queries as MetricRequest[] | null) ?? [];
  const body = insight.bodyMarkdown ?? "";

  const issues = validateTemplate(
    body,
    requests.map((request) => request.key)
  );

  if (blocksPublication(issues)) {
    const missing = issues
      .filter((issue) => issue.type === "undefined_metric")
      .map((issue) => issue.key);
    return {
      ok: false,
      error: "This body quotes figures that have no metric behind them.",
      issues: missing.map(
        (key) => `{{${key}}} appears in the body but no metric named “${key}” is defined.`
      ),
    };
  }

  if (body.trim().length === 0) {
    return { ok: false, error: "Write the body before publishing." };
  }

  const { resolved, failures } = await resolveMetrics(requests);

  if (failures.length > 0) {
    return {
      ok: false,
      error: "Some figures could not be computed, so nothing was published.",
      issues: failures.map((failure) => `${failure.key}: ${failure.reason}`),
    };
  }

  const now = new Date();
  await prisma.insight.update({
    where: { id: insight.id },
    data: {
      status: "PUBLISHED",
      publishedAt: insight.publishedAt ?? now,
      metrics: resolved as never,
      dataAsOf: now,
      sourcesUsed: sourcesFor(resolved.map((metric) => metric.key)),
    },
  });

  revalidatePath("/admin/insights");
  revalidatePath("/insights");
  revalidatePath(`/insights/${insight.slug}`);
  revalidatePath("/");

  return {
    ok: true,
    message: `Published with ${resolved.length} ${resolved.length === 1 ? "figure" : "figures"} computed just now.`,
  };
}

/** Recomputes a published insight's figures without changing its text. */
export async function refreshInsightFigures(insightId: string): Promise<InsightResult> {
  await requireAdmin();

  const insight = await prisma.insight.findUnique({ where: { id: insightId } });
  if (!insight) return { ok: false, error: "Insight not found." };
  if (insight.status !== "PUBLISHED") {
    return { ok: false, error: "Only a published insight can be refreshed." };
  }

  const requests = (insight.queries as MetricRequest[] | null) ?? [];
  const { resolved, failures } = await resolveMetrics(requests);

  if (failures.length > 0) {
    return {
      ok: false,
      error: "Some figures could not be recomputed, so nothing was changed.",
      issues: failures.map((failure) => `${failure.key}: ${failure.reason}`),
    };
  }

  await prisma.insight.update({
    where: { id: insight.id },
    data: { metrics: resolved as never, dataAsOf: new Date() },
  });

  revalidatePath(`/insights/${insight.slug}`);
  revalidatePath("/admin/insights");
  revalidatePath("/");
  return { ok: true, message: "Figures recomputed against current data." };
}

export async function unpublishInsight(insightId: string): Promise<InsightResult> {
  await requireAdmin();

  const insight = await prisma.insight.findUnique({
    where: { id: insightId },
    select: { id: true, slug: true },
  });
  if (!insight) return { ok: false, error: "Insight not found." };

  await prisma.insight.update({ where: { id: insight.id }, data: { status: "DRAFT" } });

  revalidatePath("/admin/insights");
  revalidatePath("/insights");
  revalidatePath(`/insights/${insight.slug}`);
  revalidatePath("/");
  return { ok: true, message: "Moved back to draft. It is no longer publicly visible." };
}

export async function deleteInsight(insightId: string): Promise<InsightResult> {
  await requireAdmin();

  const insight = await prisma.insight.findUnique({
    where: { id: insightId },
    select: { id: true },
  });
  if (!insight) return { ok: false, error: "Insight not found." };

  await prisma.insight.delete({ where: { id: insight.id } });

  revalidatePath("/admin/insights");
  revalidatePath("/insights");
  revalidatePath("/");
  return { ok: true, message: "Insight deleted." };
}

/** Checks a body against the selected metrics without saving anything. */
export async function checkInsightBody(
  body: string,
  metricKeys: string[]
): Promise<{ undefinedKeys: string[]; unusedKeys: string[]; used: string[] }> {
  await requireAdmin();

  const issues = validateTemplate(body, metricKeys);
  return {
    undefinedKeys: issues
      .filter((issue) => issue.type === "undefined_metric")
      .map((issue) => issue.key),
    unusedKeys: issues.filter((issue) => issue.type === "unused_metric").map((issue) => issue.key),
    used: extractPlaceholders(body),
  };
}

/** Which publishers a set of metrics drew on, for the attribution line. */
function sourcesFor(keys: string[]): string[] {
  const sources = new Set<string>();
  for (const key of keys) {
    if (key.startsWith("companies_")) sources.add("Companies House");
    if (key.startsWith("procurement_")) sources.add("Sell2Wales");
    if (key.startsWith("planning_")) sources.add("Welsh planning authorities");
    if (key.startsWith("funding_")) sources.add("Funding publishers");
  }
  return [...sources];
}
