"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { checkCountLimit, recordUsage } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";

const idSchema = z.string().uuid();

export type SaveResult = { saved: boolean; error?: string };

/**
 * Follows or unfollows a company. Following is capped by plan, so the limit is
 * checked server-side before the write — the button in the browser is a
 * convenience, not the enforcement point.
 */
export async function toggleSavedCompany(companyId: string): Promise<SaveResult> {
  const user = await requireUser();

  const parsed = idSchema.safeParse(companyId);
  if (!parsed.success) return { saved: false, error: "Invalid company." };

  const existing = await prisma.savedCompany.findUnique({
    where: { userId_companyId: { userId: user.id, companyId: parsed.data } },
    select: { id: true },
  });

  if (existing) {
    await prisma.savedCompany.delete({ where: { id: existing.id } });
    revalidatePath("/dashboard/saved");
    return { saved: false };
  }

  const company = await prisma.company.findUnique({
    where: { id: parsed.data },
    select: { id: true, name: true },
  });
  if (!company) return { saved: false, error: "That company is not in the register." };

  const currentCount = await prisma.savedCompany.count({ where: { userId: user.id } });
  const limit = await checkCountLimit(user, "savedCompanies", currentCount);
  if (!limit.allowed) {
    return { saved: false, error: limit.reason };
  }

  await prisma.savedCompany.create({
    data: { userId: user.id, companyId: company.id },
  });
  await recordUsage(user, "SAVED_COMPANY", { companyId: company.id });

  revalidatePath("/dashboard/saved");
  return { saved: true };
}
