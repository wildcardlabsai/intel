import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InsightEditor, type InsightDraft, type MetricOption } from "@/app/admin/insights/editor";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { METRIC_DEFINITIONS } from "@/lib/insights/metrics";

export const metadata: Metadata = { title: "Edit insight | Admin" };
export const dynamic = "force-dynamic";

const METRIC_OPTIONS: MetricOption[] = METRIC_DEFINITIONS.map((definition) => ({
  key: definition.key,
  label: definition.label,
  description: definition.description,
  params: definition.params.map((param) => ({
    name: param.name,
    label: param.label,
    type: param.type,
    options: param.options,
  })),
}));

export default async function EditInsightPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const draft: InsightDraft =
    id === "new"
      ? {
          id: null,
          title: "",
          slug: "",
          category: "",
          summary: "",
          bodyMarkdown: "",
          status: "DRAFT",
          metrics: [],
        }
      : await loadDraft(id);

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title={draft.id ? "Edit insight" : "New insight"}
        description="Figures are computed from the database when you publish. Nothing is typed in by hand."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/insights">All insights</Link>
          </Button>
        }
      />
      <InsightEditor draft={draft} metricOptions={METRIC_OPTIONS} />
    </>
  );
}

async function loadDraft(id: string): Promise<InsightDraft> {
  const insight = await prisma.insight.findUnique({ where: { id } });
  if (!insight) notFound();

  const metrics = Array.isArray(insight.queries)
    ? (insight.queries as Array<{ key?: unknown; params?: unknown }>)
        .filter((entry) => typeof entry?.key === "string")
        .map((entry) => ({
          key: entry.key as string,
          params: (entry.params ?? {}) as Record<string, string>,
        }))
    : [];

  return {
    id: insight.id,
    title: insight.title,
    slug: insight.slug,
    category: insight.category,
    summary: insight.summary ?? "",
    bodyMarkdown: insight.bodyMarkdown ?? "",
    status: insight.status as InsightDraft["status"],
    metrics,
  };
}
