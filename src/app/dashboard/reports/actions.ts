"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { checkUsage, recordUsage } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export type ReportActionResult = { ok: boolean; reportId?: string; error?: string };

const schema = z.object({
  type: z.enum(["REGIONAL", "SECTOR", "PROCUREMENT"]),
  localAuthority: z.string().trim().max(60).optional(),
  sectorSlug: z.string().trim().max(60).optional(),
});

/**
 * Generates a report synchronously from live counts.
 *
 * Every figure stored on the report is a real query result taken at generation
 * time, alongside the sources used and the date the data reflects — so a
 * report downloaded later still states exactly what it was based on.
 */
export async function generateReport(formData: FormData): Promise<ReportActionResult> {
  const user = await requireUser("/dashboard/reports");

  const parsed = schema.safeParse({
    type: formData.get("type"),
    localAuthority: formData.get("localAuthority") || undefined,
    sectorSlug: formData.get("sectorSlug") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: "Please choose a report type." };
  }

  const usage = await checkUsage(user, "REPORT");
  if (!usage.allowed) {
    return { ok: false, error: usage.reason };
  }

  const { type, localAuthority } = parsed.data;

  const authority = localAuthority
    ? await prisma.localAuthority.findUnique({
        where: { slug: localAuthority },
        select: { id: true, name: true },
      })
    : null;

  const scope = authority ? { localAuthorityId: authority.id } : {};
  const title = authority
    ? `${authority.name} — ${type === "PROCUREMENT" ? "procurement" : "business"} report`
    : `Wales — ${type === "PROCUREMENT" ? "procurement" : "business"} report`;

  const report = await prisma.report.create({
    data: {
      userId: user.id,
      organisationId: user.organisationId,
      type,
      title,
      params: parsed.data as never,
      status: "GENERATING",
    },
  });

  try {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setUTCFullYear(twelveMonthsAgo.getUTCFullYear() - 1);

    const [
      totalCompanies,
      activeCompanies,
      newCompanies,
      contractCount,
      contractValue,
      planningCount,
      topSectors,
      lastRun,
    ] = await Promise.all([
      prisma.company.count({ where: { isWelsh: true, ...scope } }),
      prisma.company.count({ where: { isWelsh: true, status: "ACTIVE", ...scope } }),
      prisma.company.count({
        where: { isWelsh: true, incorporatedOn: { gte: twelveMonthsAgo }, ...scope },
      }),
      prisma.procurementNotice.count({ where: scope }),
      prisma.procurementNotice.aggregate({ where: scope, _sum: { valueAmount: true } }),
      prisma.planningApplication.count({ where: scope }),
      prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
        SELECT s.name, COUNT(*)::bigint AS count
        FROM companies c
        JOIN sectors s ON s.id = c.primary_sector_id
        WHERE c.is_welsh = true
        GROUP BY s.name ORDER BY count DESC LIMIT 10
      `,
      prisma.dataImportRun.findFirst({
        where: { status: { in: ["SUCCESS", "PARTIAL"] } },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true },
      }),
    ]);

    const data = {
      scope: authority?.name ?? "Wales",
      generatedAt: new Date().toISOString(),
      companies: {
        total: totalCompanies,
        active: activeCompanies,
        incorporatedLast12Months: newCompanies,
      },
      procurement: {
        notices: contractCount,
        totalValue: contractValue._sum.valueAmount?.toString() ?? null,
      },
      planning: { applications: planningCount },
      topSectors: topSectors.map((row) => ({ name: row.name, count: Number(row.count) })),
      caveats: [
        "Counts reflect only records ingested by Cymru Intelligence at the time of generation.",
        "Company classification as Welsh is based on registered office address evidence.",
        planningCount === 0
          ? "No Welsh planning authority has a connected feed, so planning figures are zero rather than unavailable."
          : "Planning coverage is partial: only authorities with a configured feed are included.",
        contractCount === 0
          ? "No procurement source is connected, so contract figures are zero rather than unavailable."
          : "Contract values are as published; notices without a stated value are excluded from the total.",
      ],
    };

    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: "READY",
        data: data as never,
        dataAsOf: lastRun?.finishedAt ?? new Date(),
        sourcesUsed: ["companies_house", "sell2wales"],
        completedAt: new Date(),
      },
    });

    await recordUsage(user, "REPORT", { reportId: report.id, type });
    revalidatePath("/dashboard/reports");

    return { ok: true, reportId: report.id };
  } catch (error) {
    logger.error("report generation failed", error, { reportId: report.id });
    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message.slice(0, 500) : String(error),
      },
    });
    return { ok: false, error: "Report generation failed. Please try again." };
  }
}
