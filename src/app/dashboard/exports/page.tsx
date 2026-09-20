import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Export data | Cymru Intelligence" };
export const dynamic = "force-dynamic";

const EXPORT_FORMATS = [
  { value: "csv", label: "Export CSV", limit: 1000, primary: true },
  { value: "xlsx", label: "Export spreadsheet", limit: 1000, primary: false },
  { value: "pdf", label: "Export PDF", limit: 500, primary: false },
] as const;

export default async function ExportsPage() {
  const user = await requireUser("/dashboard/exports");

  const [entitlements, usedThisMonth, companyCount] = await Promise.all([
    getEntitlements(user),
    countExportsThisMonth(user.id, user.organisationId),
    prisma.company.count({ where: { isWelsh: true } }),
  ]);

  const included = entitlements.limits.exportsPerMonth !== 0;
  const remaining =
    entitlements.limits.exportsPerMonth === -1
      ? null
      : Math.max(0, entitlements.limits.exportsPerMonth - usedThisMonth);

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Export data"
        description="Download search results as CSV, a spreadsheet or a PDF. Every row keeps its source and source URL so the data stays attributable."
      />

      {!included ? (
        <Card>
          <CardContent className="p-6">
            <Badge tone="warning">Not included in your plan</Badge>
            <h3 className="mt-3 text-base font-bold text-ink-900">
              Exports are available on Pro and above
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Your {entitlements.planName} plan does not include data export. Upgrade to download
              search results as CSV, a spreadsheet or a PDF.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/dashboard/billing">View plans</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>This month</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted">
              {formatNumber(usedThisMonth)} exports used
              {remaining !== null ? ` · ${formatNumber(remaining)} remaining` : " · unlimited"}
              {entitlements.limits.bulkExport
                ? " · bulk export enabled (up to 10,000 rows)"
                : " · up to 1,000 rows per export"}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Welsh companies</CardTitle>
              <p className="mt-1 text-sm text-muted">
                {formatNumber(companyCount)} companies currently ingested. Add filters on the company
                search page, then export exactly what you see.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-3">
                {EXPORT_FORMATS.map((format) => (
                  <Button key={format.value} asChild variant={format.primary ? "primary" : "outline"}>
                    <a
                      href={`/api/export/companies?format=${format.value}&limit=${format.limit}`}
                    >
                      <Download className="h-4 w-4" />
                      {format.label}
                    </a>
                  </Button>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-muted">
                CSV and the spreadsheet carry all 15 columns. The PDF is a printable summary of the
                10 that fit a page legibly, capped at 2,000 rows, and states which columns it leaves
                out.
              </p>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/companies">Build a filtered search first</Link>
              </Button>
            </CardContent>
          </Card>

          <p className="text-xs leading-relaxed text-muted">
            Exported data contains public sector information licensed under the Open Government
            Licence v3.0. Attribution is required when you redistribute it. Each row includes the
            publisher and the original record URL so attribution is always possible.
          </p>
        </>
      )}
    </>
  );
}

async function countExportsThisMonth(userId: string, organisationId: string | null): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return prisma.usageEvent.count({
    where: {
      kind: "EXPORT",
      createdAt: { gte: monthStart },
      OR: [...(organisationId ? [{ organisationId }] : []), { userId }],
    },
  });
}
