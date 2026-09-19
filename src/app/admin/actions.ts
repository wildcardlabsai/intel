"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getConnector } from "@/lib/ingestion/connectors";
import { runConnector } from "@/lib/ingestion/runner";
import { logger } from "@/lib/logger";

export type AdminActionResult = {
  ok: boolean;
  message: string;
  detail?: string;
};

/**
 * Triggers a connector run from the admin screen. Runs are capped so an
 * administrator cannot accidentally start work that outlives the request; a
 * full backfill is done through the cron endpoint with a higher limit.
 */
export async function runConnectorNow(connectorKey: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const connector = getConnector(connectorKey);

  if (!connector) {
    return { ok: false, message: `No connector registered with key "${connectorKey}".` };
  }

  const readiness = connector.readiness();
  if (!readiness.ready) {
    return { ok: false, message: "Not configured", detail: readiness.reason };
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      actorEmail: admin.email,
      action: "connector.run",
      entityType: "connector",
      entityId: connectorKey,
    },
  });

  try {
    const result = await runConnector(connector, {
      trigger: "MANUAL",
      limit: 500,
      triggeredByUserId: admin.id,
    });

    revalidatePath("/admin/sources");
    revalidatePath("/admin/imports");

    if (result.notConfiguredReason) {
      return { ok: false, message: "Not configured", detail: result.notConfiguredReason };
    }

    return {
      ok: result.status !== "FAILED",
      message: `${result.status}: ${result.counters.created} new, ${result.counters.updated} updated, ${result.counters.skipped} unchanged, ${result.counters.rejected} rejected`,
      detail: result.errors[0]?.message,
    };
  } catch (error) {
    logger.error("manual connector run failed", error, { connectorKey });
    return {
      ok: false,
      message: "Run failed",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Enables or disables a source without deleting anything it has ingested. */
export async function setSourceEnabled(
  sourceId: string,
  enabled: boolean
): Promise<AdminActionResult> {
  const admin = await requireAdmin();

  const source = await prisma.dataSource.update({
    where: { id: sourceId },
    data: { enabled, ...(enabled ? {} : { status: "DISABLED" }) },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      actorEmail: admin.email,
      action: enabled ? "source.enabled" : "source.disabled",
      entityType: "data_source",
      entityId: sourceId,
      metadata: { key: source.key },
    },
  });

  revalidatePath("/admin/sources");
  return { ok: true, message: enabled ? "Source enabled" : "Source disabled" };
}

/**
 * Merges a duplicate company into a canonical one. The duplicate's name
 * becomes an alias so future ingestion resolves to the survivor, and every
 * cross-source link is repointed rather than deleted.
 */
export async function mergeCompanies(
  survivorId: string,
  duplicateId: string
): Promise<AdminActionResult> {
  const admin = await requireAdmin();

  if (survivorId === duplicateId) {
    return { ok: false, message: "Cannot merge a company into itself." };
  }

  const [survivor, duplicate] = await Promise.all([
    prisma.company.findUnique({ where: { id: survivorId } }),
    prisma.company.findUnique({ where: { id: duplicateId } }),
  ]);

  if (!survivor || !duplicate) {
    return { ok: false, message: "One or both companies were not found." };
  }

  await prisma.$transaction([
    prisma.companyAlias.upsert({
      where: {
        companyId_normalisedAlias: {
          companyId: survivorId,
          normalisedAlias: duplicate.normalisedName,
        },
      },
      create: {
        companyId: survivorId,
        alias: duplicate.name,
        normalisedAlias: duplicate.normalisedName,
        source: "admin_merge",
        confidence: 1,
      },
      update: {},
    }),
    prisma.procurementSupplier.updateMany({
      where: { resolvedCompanyId: duplicateId },
      data: { resolvedCompanyId: survivorId },
    }),
    prisma.procurementBuyer.updateMany({
      where: { resolvedCompanyId: duplicateId },
      data: { resolvedCompanyId: survivorId },
    }),
    prisma.planningApplication.updateMany({
      where: { resolvedCompanyId: duplicateId },
      data: { resolvedCompanyId: survivorId },
    }),
    prisma.fundingAward.updateMany({
      where: { resolvedCompanyId: duplicateId },
      data: { resolvedCompanyId: survivorId },
    }),
    prisma.savedCompany.deleteMany({ where: { companyId: duplicateId } }),
    prisma.company.delete({ where: { id: duplicateId } }),
    prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        actorEmail: admin.email,
        action: "company.merged",
        entityType: "company",
        entityId: survivorId,
        metadata: {
          mergedCompanyNumber: duplicate.companyNumber,
          mergedName: duplicate.name,
        },
      },
    }),
  ]);

  revalidatePath("/admin/quality");
  return {
    ok: true,
    message: `Merged ${duplicate.name} (${duplicate.companyNumber}) into ${survivor.name}.`,
  };
}
