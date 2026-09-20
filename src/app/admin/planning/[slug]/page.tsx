import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlanningAuthorityForm } from "@/app/admin/planning/authority-form";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PLANNING_ADAPTERS, UNSUPPORTED_ADAPTERS } from "@/lib/sources/planning/config";
import { formatDateTime, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Planning authority | Admin" };
export const dynamic = "force-dynamic";

export default async function PlanningAuthorityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;

  const authority = await prisma.planningAuthority.findUnique({
    where: { slug },
    include: { _count: { select: { applications: true } } },
  });
  if (!authority) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Planning authority"
        title={authority.name}
        description={
          authority.portalUrl
            ? `Public portal: ${authority.portalUrl}`
            : "No public portal recorded for this authority."
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/planning">All authorities</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-5 text-xs sm:grid-cols-4">
          <Field label="Status" value={humanise(authority.status)} />
          <Field label="Applications" value={String(authority._count.applications)} />
          <Field label="Last success" value={formatDateTime(authority.lastSuccessAt)} />
          <Field label="Last error" value={authority.lastError ?? "—"} />
        </CardContent>
      </Card>

      {authority.statusMessage && (
        <Card>
          <CardContent className="p-5">
            <Badge tone="warning">Not currently usable</Badge>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
              {authority.statusMessage}
            </p>
          </CardContent>
        </Card>
      )}

      <PlanningAuthorityForm
        slug={authority.slug}
        adapter={authority.connectorKey ?? ""}
        config={JSON.stringify(authority.connectorConfig ?? {}, null, 2)}
        supportedAdapters={[...PLANNING_ADAPTERS]}
        unsupportedAdapters={Object.entries(UNSUPPORTED_ADAPTERS).map(([key, reason]) => ({
          key,
          reason,
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Configuration format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted">
          <p>
            <code className="font-mono text-xs">fieldMap</code> maps this authority&rsquo;s own
            field names onto ours. Only <code className="font-mono text-xs">reference</code> is
            required — a field this authority does not publish is left out, and stays null rather
            than being guessed at. Nested paths such as{" "}
            <code className="font-mono text-xs">geometry.x</code> are supported.
          </p>
          <p>
            <code className="font-mono text-xs">statusMap</code> maps this
            authority&rsquo;s own status words onto ours, in lowercase. An unmapped word becomes
            UNKNOWN rather than being inferred.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-white p-3 font-mono text-[11px] leading-relaxed text-ink-900">
{`{
  "endpoint": "https://maps.example.gov.wales/arcgis/rest/services/Planning/FeatureServer/0/query",
  "pageSize": 200,
  "recordUrlTemplate": "https://planning.example.gov.wales/app/{reference}",
  "fieldMap": {
    "reference": "REFVAL",
    "siteAddress": "LOCATION",
    "postcode": "POSTCODE",
    "description": "PROPOSAL",
    "applicationType": "APPTYPE",
    "status": "STATUS",
    "submittedOn": "RECEIVED",
    "decidedOn": "DECISIONDATE",
    "applicantName": "APPLICANT",
    "easting": "EASTING",
    "northing": "NORTHING"
  },
  "statusMap": {
    "pending consideration": "PENDING",
    "decided - approved": "APPROVED",
    "decided - refused": "REFUSED"
  }
}`}
          </pre>
        </CardContent>
      </Card>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 break-words text-ink-900">{value}</p>
    </div>
  );
}
