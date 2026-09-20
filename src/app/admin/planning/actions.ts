"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { runConnector } from "@/lib/ingestion/runner";
import {
  PLANNING_ADAPTERS,
  UNSUPPORTED_ADAPTERS,
  readPlanningConfig,
} from "@/lib/sources/planning/config";
import { createPlanningConnector } from "@/lib/sources/planning/connector";

/**
 * Planning authority configuration.
 *
 * Connecting an authority is a configuration change: an adapter, an endpoint
 * and a map from that authority's field names onto ours. The configuration is
 * validated here before it is stored, so an authority is only ever marked
 * CONNECTED once its configuration would actually run.
 */

export type PlanningAdminResult = {
  ok: boolean;
  error?: string;
  message?: string;
  counters?: Record<string, number>;
};

const adapterSchema = z.enum([
  ...PLANNING_ADAPTERS,
  ...(Object.keys(UNSUPPORTED_ADAPTERS) as [string, ...string[]]),
]);

export async function savePlanningConfig(formData: FormData): Promise<PlanningAdminResult> {
  await requireAdmin();

  const slug = z.string().min(1).safeParse(formData.get("slug"));
  if (!slug.success) return { ok: false, error: "Unknown authority." };

  const adapter = adapterSchema.safeParse(formData.get("adapter"));
  if (!adapter.success) return { ok: false, error: "Choose an adapter." };

  const rawConfig = formData.get("config");
  let parsedConfig: unknown = {};
  if (typeof rawConfig === "string" && rawConfig.trim().length > 0) {
    try {
      parsedConfig = JSON.parse(rawConfig);
    } catch (error) {
      return {
        ok: false,
        error: `The configuration is not valid JSON: ${
          error instanceof Error ? error.message : "parse failed"
        }`,
      };
    }
  }

  const authority = await prisma.planningAuthority.findUnique({ where: { slug: slug.data } });
  if (!authority) return { ok: false, error: "Authority not found." };

  const check = readPlanningConfig(adapter.data, parsedConfig);

  // An authority is only CONNECTED once its configuration would actually run.
  // Anything else is recorded with the reason, so the planning page can say
  // precisely why that authority has no data.
  const unsupported = adapter.data in UNSUPPORTED_ADAPTERS;

  await prisma.planningAuthority.update({
    where: { id: authority.id },
    data: {
      connectorKey: adapter.data,
      connectorConfig: parsedConfig as never,
      status: check.ok ? "CONNECTED" : unsupported ? "UNAVAILABLE" : "NOT_CONFIGURED",
      statusMessage: check.ok ? null : check.reason,
    },
  });

  revalidatePath("/admin/planning");
  revalidatePath(`/admin/planning/${slug.data}`);
  revalidatePath("/dashboard/planning");
  revalidatePath("/dashboard/sources");

  return check.ok
    ? { ok: true, message: "Configuration saved. This authority is now connected." }
    : { ok: true, message: `Saved, but not yet usable: ${check.reason}` };
}

/**
 * Runs one authority immediately, reading only a handful of records, so an
 * administrator can see whether a new field map actually works before letting
 * the nightly job loose on it.
 */
export async function testPlanningConnector(slug: string): Promise<PlanningAdminResult> {
  await requireAdmin();

  const authority = await prisma.planningAuthority.findUnique({ where: { slug } });
  if (!authority) return { ok: false, error: "Authority not found." };

  const connector = createPlanningConnector(authority);
  const readiness = connector.readiness();
  if (!readiness.ready) return { ok: false, error: readiness.reason };

  try {
    const result = await runConnector(connector, { trigger: "MANUAL", limit: 10, cursor: null });

    await prisma.planningAuthority.update({
      where: { id: authority.id },
      data:
        result.status === "FAILED"
          ? {
              status: "ERROR",
              lastErrorAt: new Date(),
              lastError: result.errors[0]?.message ?? "Run failed.",
            }
          : { status: "CONNECTED", statusMessage: null, lastSuccessAt: new Date(), lastError: null },
    });

    revalidatePath(`/admin/planning/${slug}`);

    if (result.status === "FAILED") {
      return {
        ok: false,
        error: result.errors[0]?.message ?? "The test run failed.",
        counters: result.counters,
      };
    }

    return {
      ok: true,
      message: `Read ${result.counters.fetched} records: ${result.counters.created} new, ${result.counters.updated} updated, ${result.counters.rejected} rejected.`,
      counters: result.counters,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.planningAuthority.update({
      where: { id: authority.id },
      data: { status: "ERROR", lastErrorAt: new Date(), lastError: message },
    });
    revalidatePath(`/admin/planning/${slug}`);
    return { ok: false, error: message };
  }
}

/** Disconnects an authority, leaving its already-ingested records in place. */
export async function disconnectPlanningAuthority(slug: string): Promise<PlanningAdminResult> {
  await requireAdmin();

  const authority = await prisma.planningAuthority.findUnique({ where: { slug } });
  if (!authority) return { ok: false, error: "Authority not found." };

  await prisma.planningAuthority.update({
    where: { id: authority.id },
    data: {
      connectorKey: null,
      connectorConfig: {} as never,
      status: "UNAVAILABLE",
      statusMessage: "Disconnected by an administrator.",
    },
  });

  revalidatePath("/admin/planning");
  revalidatePath("/dashboard/planning");
  return {
    ok: true,
    message: "Disconnected. Records already ingested are kept, and stop being refreshed.",
  };
}
