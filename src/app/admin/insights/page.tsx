import type { Metadata } from "next";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDate, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Insights | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminInsightsPage() {
  await requireAdmin();

  const insights = await prisma.insight.findMany({
    orderBy: { createdAt: "desc" },
    include: { author: { select: { email: true, name: true } } },
  });

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Insights"
        description="Editorial pieces backed by database queries. Every figure quoted in an insight records the query behind it, so published statistics stay reproducible."
      />

      {insights.length === 0 ? (
        <EmptyState
          title="No insights yet"
          description="Insights are written against live data and store the queries behind every figure. None have been created."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Status</Th>
                  <Th>Author</Th>
                  <Th>Data as of</Th>
                  <Th>Published</Th>
                </tr>
              </thead>
              <tbody>
                {insights.map((insight) => (
                  <tr key={insight.id}>
                    <Td>
                      <p className="font-medium text-ink-900">{insight.title}</p>
                      <p className="font-mono text-xs text-muted">{insight.slug}</p>
                    </Td>
                    <Td>
                      <Badge tone={insight.status === "PUBLISHED" ? "positive" : "neutral"}>
                        {humanise(insight.status)}
                      </Badge>
                    </Td>
                    <Td className="text-muted">
                      {insight.author?.name ?? insight.author?.email ?? "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(insight.dataAsOf)}</Td>
                    <Td className="whitespace-nowrap text-muted">
                      {formatDate(insight.publishedAt)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How insights work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed text-muted">
          <p>
            An insight stores its body, the data date, the sources used, and the exact queries
            behind each figure it quotes. That means a published statistic can always be
            re-verified against the database at a later date.
          </p>
          <p>
            Statistics are never written by hand into an insight body. If the data does not support
            a claim, the claim does not get published.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
