import type { Metadata } from "next";
import Link from "next/link";

import { ApiKeyManager } from "@/app/dashboard/api/key-manager";
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
import { formatDate, formatNumber, formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "API access | Cymru Intelligence" };
export const dynamic = "force-dynamic";

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/companies", description: "Search Welsh companies with filters." },
  {
    method: "GET",
    path: "/api/v1/companies/{companyNumber}",
    description: "Full company profile including officers, filings, contracts and planning.",
  },
  { method: "GET", path: "/api/v1/procurement", description: "Search procurement notices and awards." },
  { method: "GET", path: "/api/v1/sources", description: "Data source registry, status and licences." },
];

export default async function ApiPage() {
  const user = await requireUser("/dashboard/api");
  const [entitlements, keys, monthlyCalls] = await Promise.all([
    getEntitlements(user),
    prisma.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        rateLimitPerMinute: true,
      },
    }),
    countMonthlyApiCalls(user.id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="API access"
        description="Query Welsh company, procurement and source data programmatically."
      />

      {!entitlements.limits.apiAccess ? (
        <Card>
          <CardContent className="p-6">
            <Badge tone="warning">Not included in your plan</Badge>
            <h3 className="mt-3 text-base font-bold text-ink-900">
              API access is available on Business and Enterprise
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Your {entitlements.planName} plan does not include API access. Upgrade to create keys
              and query the endpoints below.
            </p>
            <Link
              href="/dashboard/billing"
              className="mt-4 inline-block text-sm font-semibold text-accent-green hover:underline"
            >
              View plans
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Usage this month</CardTitle>
                <p className="mt-1 text-sm text-muted">
                  {formatNumber(monthlyCalls)}
                  {entitlements.limits.apiRequestsPerMonth === -1
                    ? " requests (unlimited)"
                    : ` of ${formatNumber(entitlements.limits.apiRequestsPerMonth)} requests`}
                </p>
              </div>
            </CardHeader>
          </Card>

          <ApiKeyManager keys={keys} />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-green-900 p-4 font-mono text-xs text-cream">
            <p className="text-emerald-200/70"># Authentication</p>
            <p className="mt-1 break-all">
              curl -H &quot;Authorization: Bearer ci_live_…&quot; \
              <br />
              {"  "}https://cymru-intelligence.wales/api/v1/companies?q=manufacturing&amp;region=SOUTH_WALES
            </p>
          </div>

          <ul className="divide-y divide-border/60">
            {ENDPOINTS.map((endpoint) => (
              <li key={endpoint.path} className="flex flex-wrap items-baseline gap-3 py-3">
                <Badge tone="info">{endpoint.method}</Badge>
                <code className="font-mono text-sm text-ink-900">{endpoint.path}</code>
                <span className="text-sm text-muted">{endpoint.description}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-md border border-border bg-cream/60 p-4 text-xs leading-relaxed text-muted">
            <p className="font-semibold text-ink-900">Attribution</p>
            <p className="mt-1">
              Responses include the source and original URL for every record. Public sector
              information is licensed under the Open Government Licence v3.0 and must be attributed
              accordingly when redistributed.
            </p>
          </div>
        </CardContent>
      </Card>

      {keys.length > 0 && (
        <p className="text-xs text-muted">
          Keys are stored as hashes. If you lose a key we cannot recover it — revoke it and create a
          new one. Oldest key created {formatDate(keys[keys.length - 1].createdAt)}, last used{" "}
          {formatRelative(keys[0].lastUsedAt)}.
        </p>
      )}
    </>
  );
}

async function countMonthlyApiCalls(userId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return prisma.usageEvent.count({
    where: { userId, kind: "API_CALL", createdAt: { gte: monthStart } },
  });
}
