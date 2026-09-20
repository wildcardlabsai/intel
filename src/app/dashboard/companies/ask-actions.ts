"use server";

import { z } from "zod";

import { interpretCompanyQuery } from "@/lib/ai/interpret";
import { requireUser } from "@/lib/auth/session";
import { checkUsage, recordUsage } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import { describeSavedSearch, savedSearchHref } from "@/lib/search/saved-search";

/**
 * Turns a plain-English phrase into an ordinary company search URL.
 *
 * The result is a normal search: the same URL the filter panel would produce,
 * shareable, bookmarkable and saveable. Nothing about the results themselves
 * comes from the model — it only decides which filters to apply, and the user
 * is shown exactly which ones those were before the results.
 */

export type AskResult =
  | { status: "ok"; href: string; description: string; dropped: string[]; unresolved: string[] }
  | { status: "not_configured"; missingEnvVars: string[] }
  | { status: "no_filters"; href: string; phrase: string }
  | { status: "error"; message: string };

const phraseSchema = z.string().trim().min(3, "Describe what you are looking for.").max(500);

export async function askCompanySearch(formData: FormData): Promise<AskResult> {
  const user = await requireUser("/dashboard/companies");

  const parsed = phraseSchema.safeParse(formData.get("phrase"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the phrase." };
  }

  // Interpreting counts as a search, because it is one.
  const usage = await checkUsage(user, "SEARCH");
  if (!usage.allowed) {
    return { status: "error", message: usage.reason ?? "Monthly search limit reached." };
  }

  const localAuthorities = await prisma.localAuthority.findMany({
    select: { slug: true, name: true, welshName: true },
    orderBy: { name: "asc" },
  });

  const result = await interpretCompanyQuery(parsed.data, localAuthorities);

  if (result.status === "not_configured") {
    return { status: "not_configured", missingEnvVars: result.missingEnvVars };
  }

  if (result.status === "failed") {
    // Falling back to keyword search is always better than an error page: the
    // words the user typed are a perfectly good search on their own.
    return {
      status: "no_filters",
      href: savedSearchHref("COMPANY", parsed.data, {}),
      phrase: parsed.data,
    };
  }

  if (result.status === "no_filters") {
    return {
      status: "no_filters",
      href: savedSearchHref("COMPANY", parsed.data, {}),
      phrase: parsed.data,
    };
  }

  const { q, welshOnly, ...filters } = result.interpretation.filters;
  void welshOnly;

  await recordUsage(user, "SEARCH", { entity: "company", interpreted: true });

  return {
    status: "ok",
    href: savedSearchHref("COMPANY", q ?? null, filters as Record<string, unknown>),
    // Built locally from the validated filters, never taken from the model, so
    // what the user reads is always what was actually searched for.
    description: describeSavedSearch(q ?? null, filters as Record<string, unknown>),
    dropped: result.interpretation.dropped,
    unresolved: result.interpretation.unresolved,
  };
}
