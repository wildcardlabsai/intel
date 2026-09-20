import type { Metadata } from "next";

import { WalesMapView } from "@/app/dashboard/map/map-view";
import { SourceFooter } from "@/components/source-attribution";
import { Badge, Card, CardContent, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatNumber, formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Map | Cymru Intelligence" };
export const dynamic = "force-dynamic";

const MAX_MARKERS = 1_000;

export default async function MapPage() {
  await requireUser("/dashboard/map");

  // Only records with real coordinates are plotted. Nothing is placed at an
  // approximate or invented position.
  const [companies, notices, planning, lastRun] = await Promise.all([
    prisma.company.findMany({
      where: { isWelsh: true, latitude: { not: null }, longitude: { not: null } },
      orderBy: { lastUpdatedAt: "desc" },
      take: MAX_MARKERS,
      select: {
        id: true,
        companyNumber: true,
        name: true,
        latitude: true,
        longitude: true,
        town: true,
      },
    }),
    prisma.procurementNotice.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: MAX_MARKERS,
      select: { id: true, title: true, latitude: true, longitude: true, valueAmount: true },
    }),
    prisma.planningApplication.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      orderBy: { submittedOn: "desc" },
      take: MAX_MARKERS,
      select: { id: true, reference: true, siteAddress: true, latitude: true, longitude: true },
    }),
  ]).then(async ([c, n, p]) => [
    c,
    n,
    p,
    await prisma.dataImportRun.findFirst({
      where: { status: { in: ["SUCCESS", "PARTIAL"] } },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
  ] as const);

  const layers = [
    {
      key: "companies",
      label: "Companies",
      colour: "#102A23",
      markers: companies.map((company) => ({
        id: company.id,
        latitude: company.latitude as number,
        longitude: company.longitude as number,
        title: company.name,
        subtitle: company.town,
        href: `/dashboard/companies/${company.companyNumber}`,
      })),
    },
    {
      key: "procurement",
      label: "Contracts",
      colour: "#326052",
      markers: notices.map((notice) => ({
        id: notice.id,
        latitude: notice.latitude as number,
        longitude: notice.longitude as number,
        title: notice.title,
        subtitle: notice.valueAmount ? `£${Number(notice.valueAmount).toLocaleString("en-GB")}` : null,
        href: `/dashboard/procurement/${notice.id}`,
      })),
    },
    {
      key: "planning",
      label: "Planning",
      colour: "#8a6d3b",
      markers: planning.map((application) => ({
        id: application.id,
        latitude: application.latitude as number,
        longitude: application.longitude as number,
        title: application.reference,
        subtitle: application.siteAddress,
        href: `/dashboard/planning/${application.id}`,
      })),
    },
  ];

  const totalMarkers = layers.reduce((total, layer) => total + layer.markers.length, 0);

  return (
    <>
      <PageHeader
        eyebrow="Map"
        title="Wales at a glance"
        description="Records with a confirmed location, plotted from their postcode. Records without coordinates are not shown rather than placed approximately."
        actions={
          lastRun?.finishedAt ? (
            <Badge tone="neutral">Data updated {formatRelative(lastRun.finishedAt)}</Badge>
          ) : undefined
        }
      />

      {totalMarkers === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <h3 className="text-base font-bold text-ink-900">Nothing to plot yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
              The map plots records that have been geocoded from a real postcode. Once a source has
              synced and postcodes have been resolved, markers appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink-900">{formatNumber(totalMarkers)}</span> located
            records
            {totalMarkers >= MAX_MARKERS
              ? ` (showing the most recent ${formatNumber(MAX_MARKERS)} per layer)`
              : ""}
          </p>
          <WalesMapView layers={layers} styleUrl={process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? null} />
        </>
      )}

      <SourceFooter
        sources={["companies_house", "sell2wales", "postcodes_io"]}
        dataAsOf={lastRun?.finishedAt}
      />
    </>
  );
}
