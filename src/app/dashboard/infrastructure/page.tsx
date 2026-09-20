import type { Metadata } from "next";

import { DatasetStatus } from "@/components/dashboard/dataset-placeholder";
import { SourceBadge } from "@/components/source-attribution";
import { Badge, Card, CardContent, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency, formatDate, formatNumber, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Infrastructure | Cymru Intelligence" };
export const dynamic = "force-dynamic";

export default async function InfrastructurePage() {
  await requireUser("/dashboard/infrastructure");

  const total = await prisma.infrastructureProject.count();
  const projects =
    total > 0
      ? await prisma.infrastructureProject.findMany({
          orderBy: { startAt: "desc" },
          take: 50,
          include: { localAuthority: { select: { name: true } } },
        })
      : [];

  return (
    <>
      <PageHeader
        eyebrow="Infrastructure"
        title="Infrastructure projects"
        description="Major schemes and developments across Wales."
      />

      {total === 0 ? (
        <DatasetStatus sourceKey="datamapwales" what="infrastructure projects" />
      ) : (
        <>
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink-900">{formatNumber(total)}</span> projects
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-ink-900">{project.name}</h3>
                    {project.status && <Badge tone="neutral">{humanise(project.status)}</Badge>}
                  </div>
                  {project.description && (
                    <p className="line-clamp-3 text-sm leading-relaxed text-muted">
                      {project.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                    {project.valueAmount && (
                      <span className="text-ink-900">
                        {formatCurrency(project.valueAmount.toString(), project.currency, {
                          compact: true,
                        })}
                      </span>
                    )}
                    {project.localAuthority && <span>{project.localAuthority.name}</span>}
                    {project.startAt && <span>From {formatDate(project.startAt)}</span>}
                  </div>
                  <SourceBadge source={project.source} sourceUrl={project.sourceUrl} />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
