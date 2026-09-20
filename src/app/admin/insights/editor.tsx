"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Check, Plus, Trash2 } from "lucide-react";

import {
  publishInsight,
  refreshInsightFigures,
  saveInsight,
  unpublishInsight,
  type InsightResult,
} from "@/app/admin/insights/actions";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { extractPlaceholders, validateTemplate } from "@/lib/insights/template";

export type MetricOption = {
  key: string;
  label: string;
  description: string;
  params: Array<{
    name: string;
    label: string;
    type: "select" | "year";
    options?: Array<{ value: string; label: string }>;
  }>;
};

export type SelectedMetric = { key: string; params: Record<string, string> };

export type InsightDraft = {
  id: string | null;
  title: string;
  slug: string;
  category: string;
  summary: string;
  bodyMarkdown: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  metrics: SelectedMetric[];
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/**
 * Insight editor.
 *
 * Figures are never typed into the body. The author picks metrics, then
 * references them by name — `{{companies_active}}` — and the value is computed
 * at publish time. The editor shows, live, which placeholders have a metric
 * behind them and which do not, so the publish button is never a surprise.
 */
export function InsightEditor({
  draft,
  metricOptions,
}: {
  draft: InsightDraft;
  metricOptions: MetricOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(draft.title);
  const [slug, setSlug] = useState(draft.slug);
  const [slugTouched, setSlugTouched] = useState(draft.slug.length > 0);
  const [category, setCategory] = useState(draft.category);
  const [summary, setSummary] = useState(draft.summary);
  const [body, setBody] = useState(draft.bodyMarkdown);
  const [metrics, setMetrics] = useState<SelectedMetric[]>(draft.metrics);
  const [result, setResult] = useState<InsightResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const issues = useMemo(
    () => validateTemplate(body, metrics.map((metric) => metric.key)),
    [body, metrics]
  );
  const undefinedKeys = issues
    .filter((issue) => issue.type === "undefined_metric")
    .map((issue) => issue.key);
  const unusedKeys = issues
    .filter((issue) => issue.type === "unused_metric")
    .map((issue) => issue.key);
  const used = extractPlaceholders(body);

  function buildFormData(): FormData {
    const formData = new FormData();
    if (draft.id) formData.set("id", draft.id);
    formData.set("title", title);
    formData.set("slug", slug || slugify(title));
    formData.set("category", category);
    formData.set("summary", summary);
    formData.set("bodyMarkdown", body);
    formData.set("metrics", JSON.stringify(metrics));
    return formData;
  }

  function save(then?: (insightId: string) => Promise<InsightResult>) {
    startTransition(async () => {
      const saved = await saveInsight(buildFormData());
      if (!saved.ok || !then) {
        setResult(saved);
        if (saved.ok && saved.insightId && !draft.id) {
          router.replace(`/admin/insights/${saved.insightId}`);
        }
        return;
      }
      setResult(await then(saved.insightId!));
      router.refresh();
    });
  }

  function addMetric(key: string) {
    if (!key || metrics.some((metric) => metric.key === key)) return;
    const definition = metricOptions.find((option) => option.key === key);
    if (!definition) return;

    const params: Record<string, string> = {};
    for (const param of definition.params) {
      params[param.name] =
        param.type === "year"
          ? String(new Date().getUTCFullYear() - 1)
          : (param.options?.[0]?.value ?? "");
    }
    setMetrics((current) => [...current, { key, params }]);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (!slugTouched) setSlug(slugify(event.target.value));
              }}
            />
          </div>
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }}
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Company formations"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              rows={2}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="One or two sentences shown in the listing."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Figures</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Pick the figures this piece quotes. Each one is computed from the database when you
            publish, and the query behind it is stored with the result.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {metrics.length === 0 && (
            <p className="text-sm text-muted">No figures selected yet.</p>
          )}

          {metrics.map((metric) => {
            const definition = metricOptions.find((option) => option.key === metric.key);
            const inBody = used.includes(metric.key);
            return (
              <div key={metric.key} className="rounded-lg border border-border bg-cream/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-ink-900">
                        {`{{${metric.key}}}`}
                      </code>
                      {inBody ? (
                        <Badge tone="positive">In the body</Badge>
                      ) : (
                        <Badge tone="warning">Not used</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-ink-900">
                      {definition?.label ?? metric.key}
                    </p>
                    <p className="text-xs text-muted">{definition?.description}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setMetrics((current) => current.filter((m) => m.key !== metric.key))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>

                {definition && definition.params.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {definition.params.map((param) => (
                      <div key={param.name} className="min-w-[150px]">
                        <Label htmlFor={`${metric.key}-${param.name}`}>{param.label}</Label>
                        {param.type === "select" ? (
                          <Select
                            id={`${metric.key}-${param.name}`}
                            value={metric.params[param.name] ?? ""}
                            onChange={(event) =>
                              setMetrics((current) =>
                                current.map((m) =>
                                  m.key === metric.key
                                    ? {
                                        ...m,
                                        params: { ...m.params, [param.name]: event.target.value },
                                      }
                                    : m
                                )
                              )
                            }
                          >
                            {param.options?.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Input
                            id={`${metric.key}-${param.name}`}
                            inputMode="numeric"
                            value={metric.params[param.name] ?? ""}
                            onChange={(event) =>
                              setMetrics((current) =>
                                current.map((m) =>
                                  m.key === metric.key
                                    ? {
                                        ...m,
                                        params: { ...m.params, [param.name]: event.target.value },
                                      }
                                    : m
                                )
                              )
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <Label htmlFor="add-metric">Add a figure</Label>
              <Select
                id="add-metric"
                value=""
                onChange={(event) => addMetric(event.target.value)}
              >
                <option value="">Choose a figure…</option>
                {metricOptions
                  .filter((option) => !metrics.some((metric) => metric.key === option.key))
                  .map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
              </Select>
            </div>
            <Plus className="mb-3 h-4 w-4 text-muted" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Body</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Markdown. Write <code className="font-mono text-xs">{"{{metric_key}}"}</code> where a
            figure belongs — never type a number in by hand.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={16}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="font-mono text-xs"
            placeholder={"Wales has {{companies_active}} actively trading registered companies."}
          />

          {undefinedKeys.length > 0 && (
            <p className="flex items-start gap-2 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                These placeholders have no figure behind them, so this cannot be published:{" "}
                {undefinedKeys.map((key) => `{{${key}}}`).join(", ")}.
              </span>
            </p>
          )}

          {unusedKeys.length > 0 && (
            <p className="text-sm text-muted">
              Selected but not used in the body: {unusedKeys.join(", ")}.
            </p>
          )}

          {undefinedKeys.length === 0 && used.length > 0 && (
            <p className="flex items-center gap-2 text-sm text-accent-green">
              <Check className="h-4 w-4" />
              Every figure in the body has a query behind it.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={isPending} onClick={() => save()}>
          {isPending ? "Saving…" : "Save draft"}
        </Button>

        <Button
          type="button"
          disabled={isPending || undefinedKeys.length > 0 || body.trim().length === 0}
          title={
            undefinedKeys.length > 0
              ? "Every figure in the body needs a metric behind it"
              : undefined
          }
          onClick={() => save((insightId) => publishInsight(insightId))}
        >
          {draft.status === "PUBLISHED" ? "Save and recompute" : "Publish"}
        </Button>

        {draft.id && draft.status === "PUBLISHED" && (
          <>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => setResult(await refreshInsightFigures(draft.id!)))
              }
            >
              Recompute figures only
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setResult(await unpublishInsight(draft.id!));
                  router.refresh();
                })
              }
            >
              Unpublish
            </Button>
          </>
        )}
      </div>

      {result && (
        <div className={result.ok ? "text-sm text-accent-green" : "text-sm text-red-700"}>
          <p>{result.ok ? result.message : result.error}</p>
          {result.issues && result.issues.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {result.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
