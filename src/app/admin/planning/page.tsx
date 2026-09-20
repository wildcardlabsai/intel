import type { Metadata } from "next";
import Link from "next/link";

import {
  Badge,
  Card,
  CardContent,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatNumber, formatRelative, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Planning authorities | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPlanningPage() {
  await requireAdmin();

  const authorities = await prisma.planningAuthority.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { _count: { select: { applications: true } } },
  });

  const connected = authorities.filter((a) => a.status === "CONNECTED").length;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Planning authorities"
        description="Wales has no national planning feed. Each authority is connected separately by configuring an adapter, an endpoint and a field map — no deploy required."
        actions={
          <Badge tone={connected > 0 ? "positive" : "warning"}>
            {connected} of {authorities.length} connected
          </Badge>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Authority</Th>
                <Th>Status</Th>
                <Th>Adapter</Th>
                <Th className="hidden md:table-cell">Applications</Th>
                <Th className="hidden md:table-cell">Last success</Th>
              </tr>
            </thead>
            <tbody>
              {authorities.map((authority) => (
                <tr key={authority.id} className="hover:bg-cream/60">
                  <Td>
                    <Link
                      href={`/admin/planning/${authority.slug}`}
                      className="font-semibold text-ink-900 hover:text-accent-green"
                    >
                      {authority.name}
                    </Link>
                    {authority.statusMessage && (
                      <p className="mt-0.5 max-w-lg text-xs leading-relaxed text-muted">
                        {authority.statusMessage}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        authority.status === "CONNECTED"
                          ? "positive"
                          : authority.status === "ERROR"
                            ? "critical"
                            : authority.status === "NOT_CONFIGURED"
                              ? "warning"
                              : "neutral"
                      }
                    >
                      {humanise(authority.status)}
                    </Badge>
                  </Td>
                  <Td className="font-mono text-xs text-muted">
                    {authority.connectorKey ?? "—"}
                  </Td>
                  <Td className="hidden md:table-cell text-muted">
                    {formatNumber(authority._count.applications)}
                  </Td>
                  <Td className="hidden md:table-cell whitespace-nowrap text-muted">
                    {formatRelative(authority.lastSuccessAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border bg-cream/60 p-5 text-xs leading-relaxed text-muted">
        <p className="font-semibold text-ink-900">Why so few are connected</p>
        <p className="mt-1">
          Most Welsh authorities publish planning data only as HTML search pages built for a
          browser. There is no machine-readable feed to read, and we do not scrape public
          portals. Those authorities are recorded as unavailable with that reason, and their
          absence is stated on the planning page — never filled in with estimates.
        </p>
      </div>
    </>
  );
}
