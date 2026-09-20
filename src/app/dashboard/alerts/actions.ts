"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { EntityType } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { checkCountLimit } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import { nextRunFor, processAlert } from "@/lib/services/alerts";

export type AlertActionResult = { ok: boolean; error?: string; message?: string };

const createSchema = z.object({
  name: z.string().trim().min(2, "Give the alert a name").max(80),
  entityType: z.enum(["COMPANY", "PROCUREMENT", "PLANNING", "FUNDING"]),
  query: z.string().trim().max(200).optional(),
  frequency: z.enum(["IMMEDIATE", "DAILY", "WEEKLY"]),
  localAuthority: z.string().trim().max(60).optional(),
  minValue: z.coerce.number().min(0).optional(),
  emailEnabled: z.boolean(),
});

export async function createAlert(formData: FormData): Promise<AlertActionResult> {
  const user = await requireUser("/dashboard/alerts");

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    entityType: formData.get("entityType"),
    query: formData.get("query") || undefined,
    frequency: formData.get("frequency"),
    localAuthority: formData.get("localAuthority") || undefined,
    minValue: formData.get("minValue") || undefined,
    emailEnabled: formData.get("emailEnabled") === "on",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const activeCount = await prisma.alert.count({ where: { userId: user.id, isActive: true } });
  const limit = await checkCountLimit(user, "alerts", activeCount);
  if (!limit.allowed) {
    return { ok: false, error: limit.reason };
  }

  const { name, entityType, query, frequency, localAuthority, minValue, emailEnabled } = parsed.data;

  // An alert must have something to match on, otherwise it would notify on
  // every new record in the dataset.
  if (!query && !localAuthority && minValue === undefined) {
    return {
      ok: false,
      error: "Add a keyword, a location or a minimum value so the alert has something to match.",
    };
  }

  const filters: Record<string, unknown> = {};
  if (localAuthority) filters.localAuthority = localAuthority;
  if (minValue !== undefined) filters.minValue = minValue;

  await prisma.alert.create({
    data: {
      userId: user.id,
      name,
      entityType: entityType as EntityType,
      query: query ?? null,
      filters: filters as never,
      frequency,
      emailEnabled,
      // Start the watermark at creation time so a new alert does not
      // immediately notify about the entire back catalogue.
      watermark: new Date(),
      nextRunAt: nextRunFor(frequency, new Date()),
    },
  });

  revalidatePath("/dashboard/alerts");
  return { ok: true, message: `Alert “${name}” created.` };
}

export async function toggleAlert(alertId: string): Promise<AlertActionResult> {
  const user = await requireUser("/dashboard/alerts");

  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    select: { id: true, userId: true, isActive: true },
  });
  if (!alert || alert.userId !== user.id) return { ok: false, error: "Alert not found." };

  await prisma.alert.update({
    where: { id: alert.id },
    data: { isActive: !alert.isActive },
  });

  revalidatePath("/dashboard/alerts");
  return { ok: true, message: alert.isActive ? "Alert paused." : "Alert resumed." };
}

export async function deleteAlert(alertId: string): Promise<AlertActionResult> {
  const user = await requireUser("/dashboard/alerts");

  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    select: { id: true, userId: true },
  });
  if (!alert || alert.userId !== user.id) return { ok: false, error: "Alert not found." };

  await prisma.alert.delete({ where: { id: alert.id } });

  revalidatePath("/dashboard/alerts");
  return { ok: true, message: "Alert deleted." };
}

/** Runs an alert immediately so the user can see what it currently matches. */
export async function runAlertNow(alertId: string): Promise<AlertActionResult> {
  const user = await requireUser("/dashboard/alerts");

  const alert = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!alert || alert.userId !== user.id) return { ok: false, error: "Alert not found." };

  const result = await processAlert(alert);
  revalidatePath("/dashboard/alerts");

  return {
    ok: true,
    message:
      result.matches > 0
        ? `Found ${result.matches} new ${result.matches === 1 ? "match" : "matches"}.`
        : "No new matches since the last run.",
  };
}
