"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { checkCountLimit } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import { nextRunFor } from "@/lib/services/alerts";
import {
  captureSearch,
  isEmptySearch,
  saveableEntityTypeSchema,
} from "@/lib/search/saved-search";

export type SavedSearchResult = { ok: boolean; error?: string; message?: string };

/**
 * Saved-search actions.
 *
 * Filters are never trusted as posted: the raw URL parameters are re-validated
 * through the same schema the search page uses, so a saved search can only
 * ever contain filters the search engine accepts.
 */

const saveSchema = z.object({
  name: z.string().trim().min(2, "Give the search a name").max(80),
  entityType: saveableEntityTypeSchema,
  /** The search page's query string, exactly as the user currently sees it. */
  params: z.string().max(4000),
});

function paramsToRecord(queryString: string): Record<string, string | string[]> {
  const search = new URLSearchParams(queryString);
  const record: Record<string, string | string[]> = {};
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key);
    record[key] = values.length > 1 ? values : values[0]!;
  }
  return record;
}

export async function saveSearch(formData: FormData): Promise<SavedSearchResult> {
  const user = await requireUser("/dashboard/saved");

  const parsed = saveSchema.safeParse({
    name: formData.get("name"),
    entityType: formData.get("entityType"),
    params: formData.get("params") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const { name, entityType, params } = parsed.data;
  const captured = captureSearch(entityType, paramsToRecord(params));

  if (isEmptySearch(captured)) {
    return {
      ok: false,
      error: "There is nothing to save yet — add a search term or a filter first.",
    };
  }

  const existingCount = await prisma.savedSearch.count({ where: { userId: user.id } });
  const limit = await checkCountLimit(user, "savedSearches", existingCount);
  if (!limit.allowed) return { ok: false, error: limit.reason };

  await prisma.savedSearch.create({
    data: {
      userId: user.id,
      name,
      entityType,
      query: captured.query,
      filters: captured.filters as never,
    },
  });

  revalidatePath("/dashboard/saved");
  return { ok: true, message: `Saved as “${name}”.` };
}

export async function renameSavedSearch(
  savedSearchId: string,
  name: string
): Promise<SavedSearchResult> {
  const user = await requireUser("/dashboard/saved");

  const parsedName = z.string().trim().min(2).max(80).safeParse(name);
  if (!parsedName.success) return { ok: false, error: "Names must be 2 to 80 characters." };

  const existing = await prisma.savedSearch.findUnique({
    where: { id: savedSearchId },
    select: { id: true, userId: true },
  });
  if (!existing || existing.userId !== user.id) {
    return { ok: false, error: "Saved search not found." };
  }

  await prisma.savedSearch.update({
    where: { id: existing.id },
    data: { name: parsedName.data },
  });

  revalidatePath("/dashboard/saved");
  return { ok: true, message: "Renamed." };
}

export async function deleteSavedSearch(savedSearchId: string): Promise<SavedSearchResult> {
  const user = await requireUser("/dashboard/saved");

  const existing = await prisma.savedSearch.findUnique({
    where: { id: savedSearchId },
    select: { id: true, userId: true },
  });
  if (!existing || existing.userId !== user.id) {
    return { ok: false, error: "Saved search not found." };
  }

  await prisma.savedSearch.delete({ where: { id: existing.id } });

  revalidatePath("/dashboard/saved");
  return { ok: true, message: "Saved search deleted." };
}

/**
 * Turns a saved search into an alert, so the user is told when new records
 * start matching it. The watermark starts now: a new alert must not notify
 * about the entire back catalogue.
 */
export async function createAlertFromSavedSearch(
  savedSearchId: string
): Promise<SavedSearchResult> {
  const user = await requireUser("/dashboard/saved");

  const saved = await prisma.savedSearch.findUnique({ where: { id: savedSearchId } });
  if (!saved || saved.userId !== user.id) return { ok: false, error: "Saved search not found." };

  const activeCount = await prisma.alert.count({ where: { userId: user.id, isActive: true } });
  const limit = await checkCountLimit(user, "alerts", activeCount);
  if (!limit.allowed) return { ok: false, error: limit.reason };

  const now = new Date();
  await prisma.alert.create({
    data: {
      userId: user.id,
      name: saved.name,
      entityType: saved.entityType,
      query: saved.query,
      filters: saved.filters as never,
      frequency: "DAILY",
      watermark: now,
      nextRunAt: nextRunFor("DAILY", now),
    },
  });

  revalidatePath("/dashboard/saved");
  revalidatePath("/dashboard/alerts");
  return { ok: true, message: `Daily alert created from “${saved.name}”.` };
}
