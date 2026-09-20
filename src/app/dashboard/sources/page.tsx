import type { Metadata } from "next";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatNumber, formatRelative, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Data sources | Cymru Intelligence" };
export const dynamic = "force-dynamic";

/**
 * Read-only source registry for every signed-in user.
 *
 * Users are entitled to know exactly which datasets sit behind what they are
 * looking at, how fresh each is, and which are not connected — that honesty is
 * the point of the product, not an admin-only detail.
 */
export default async function SourcesPage() {
  await requireUser("/dashboard/sources");

  const [sources, planningAuthorities] = await Promise.all([
    prisma.dataSource.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.planningAuthority.count({ where: { status: "CONNECTED" } }).then(async (connected) => ({
      connected,
      total: await prisma.planningAuthority.count(),
    })),
  ]);

  const connected = sources.filter((source) => source.status === "CONNECTED").length;

  return (
    <>
      <PageHeader
        eyebrow="Transparency"
        title="Where this data comes from"
        description="Every dataset behind Cymru Intelligence, who publishes it, its licence and how current it is."
      />

      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink-900">
              {connected} of {sources.length}
            </span>{" "}
            sources are connected. Welsh planning is published per authority:{" "}
            <span className="font-semibold text-ink-900">
              {planningAuthorities.connected} of {planningAuthorities.total}
            </span>{" "}
            authorities have a configured feed.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {sources.map((source) => (
          <Card key={source.id}>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{source.name}</CardTitle>
                  <Badge
                    tone={
                      source.status === "CONNECTED"
                        ? "positive"
                        : source.status === "ERROR"
                          ? "critical"
                          : source.status === "NOT_CONFIGURED"
                            ? "warning"
                            : "neutral"
                    }
                  >
                    {humanise(source.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted">Published by {source.organisation}</p>
                {source.description && (
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
                    {source.description}
                  </p>
                )}
                {source.statusMessage && source.status !== "CONNECTED" && (
                  <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted">
                    {source.statusMessage}
                  </p>
                )}
              </div>

              {source.homepageUrl && (
                <a
                  href={source.homepageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-semibold text-accent-green hover:underline"
                >
                  Publisher
                </a>
              )}
            </CardHeader>

            <CardContent className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
              <Field label="Records held" value={formatNumber(source.totalRecords)} />
              <Field label="Last updated" value={formatRelative(source.lastSuccessAt)} />
              <Field
                label="Publisher cadence"
                value={source.updateFrequency ?? "Not published"}
              />
              <Field label="Licence" value={source.licence ?? "Not stated"} />
              {source.usageRestrictions && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="font-semibold uppercase tracking-wider text-muted">
                    Usage restrictions
                  </p>
                  <p className="mt-1 leading-relaxed text-muted">{source.usageRestrictions}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-cream/60 p-5 text-xs leading-relaxed text-muted">
        <p className="font-semibold text-ink-900">Our commitment</p>
        <p className="mt-1">
          Nothing on this platform is invented. Where a source is not connected, the affected pages
          say so rather than showing estimated figures. Where a dataset has no usable public feed,
          it is marked unavailable rather than quietly omitted.
        </p>
        <p className="mt-2">
          Cymru Intelligence is an independent service. Using public data published by a government
          body does not imply affiliation with or endorsement by that body.
        </p>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 text-ink-900">{value}</p>
    </div>
  );
}
