"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";

export type SettingsResult = { ok: boolean; message?: string; error?: string };

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  emailAlerts: z.boolean(),
  emailDigest: z.boolean(),
  emailProduct: z.boolean(),
});

export async function updateProfile(formData: FormData): Promise<SettingsResult> {
  const user = await requireUser("/dashboard/settings");

  const parsed = profileSchema.safeParse({
    name: formData.get("name") || undefined,
    jobTitle: formData.get("jobTitle") || undefined,
    emailAlerts: formData.get("emailAlerts") === "on",
    emailDigest: formData.get("emailDigest") === "on",
    emailProduct: formData.get("emailProduct") === "on",
  });

  if (!parsed.success) {
    return { ok: false, error: "Please check the form." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
  });

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Settings saved." };
}

/**
 * GDPR subject access: assembles everything held about the signed-in user and
 * returns it as JSON for download.
 */
export async function exportMyData(): Promise<
  { ok: true; json: string } | { ok: false; error: string }
> {
  const user = await requireUser("/dashboard/settings");

  const [record, savedCompanies, alerts, searches, reports, apiKeys, usage, consents] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        include: { organisation: { select: { name: true, slug: true } } },
      }),
      prisma.savedCompany.findMany({
        where: { userId: user.id },
        include: { company: { select: { companyNumber: true, name: true } } },
      }),
      prisma.alert.findMany({ where: { userId: user.id } }),
      prisma.savedSearch.findMany({ where: { userId: user.id } }),
      prisma.report.findMany({ where: { userId: user.id }, select: { id: true, title: true, type: true, createdAt: true } }),
      // Key hashes are deliberately excluded — exporting them would be a
      // security risk and they are not personal data.
      prisma.apiKey.findMany({
        where: { userId: user.id },
        select: { name: true, prefix: true, createdAt: true, lastUsedAt: true, revokedAt: true },
      }),
      prisma.usageEvent.findMany({
        where: { userId: user.id },
        select: { kind: true, createdAt: true, metadata: true },
        take: 5_000,
        orderBy: { createdAt: "desc" },
      }),
      prisma.consentRecord.findMany({ where: { userId: user.id } }),
    ]);

  if (!record) return { ok: false, error: "Account not found." };

  await prisma.dataSubjectRequest.create({
    data: { userId: user.id, kind: "export", status: "completed", completedAt: new Date() },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    account: {
      email: record.email,
      name: record.name,
      jobTitle: record.jobTitle,
      role: record.role,
      organisation: record.organisation,
      createdAt: record.createdAt,
      emailPreferences: {
        alerts: record.emailAlerts,
        digest: record.emailDigest,
        product: record.emailProduct,
      },
    },
    savedCompanies: savedCompanies.map((entry) => ({
      companyNumber: entry.company.companyNumber,
      name: entry.company.name,
      savedAt: entry.createdAt,
      notes: entry.notes,
    })),
    alerts,
    savedSearches: searches,
    reports,
    apiKeys,
    usage,
    consents,
  };

  return { ok: true, json: JSON.stringify(payload, null, 2) };
}

/**
 * GDPR erasure. Personal fields are scrubbed and the account is soft-deleted,
 * then the Supabase auth user is removed so sign-in is no longer possible.
 *
 * Ingested public records are untouched: they are public sector information
 * about companies, not personal data belonging to this account.
 */
export async function deleteMyAccount(confirmation: string): Promise<SettingsResult | never> {
  const user = await requireUser("/dashboard/settings");

  if (confirmation.trim().toUpperCase() !== "DELETE") {
    return { ok: false, error: 'Type DELETE to confirm.' };
  }

  await prisma.$transaction([
    prisma.savedCompany.deleteMany({ where: { userId: user.id } }),
    prisma.savedSearch.deleteMany({ where: { userId: user.id } }),
    prisma.alert.deleteMany({ where: { userId: user.id } }),
    prisma.apiKey.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        deletedAt: new Date(),
        // Scrub identifying fields but keep the row so audit and billing
        // history stay referentially intact.
        email: `deleted-${user.id}@removed.invalid`,
        name: null,
        jobTitle: null,
        phone: null,
        avatarUrl: null,
      },
    }),
    prisma.dataSubjectRequest.create({
      data: { userId: user.id, kind: "erasure", status: "completed", completedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorEmail: user.email,
        action: "account.deleted",
        entityType: "user",
        entityId: user.id,
      },
    }),
  ]);

  if (isConfigured("supabase")) {
    try {
      await createAdminClient().auth.admin.deleteUser(user.authId);
    } catch (error) {
      // The product record is already erased; log so an administrator can
      // remove the orphaned auth user.
      logger.error("failed to delete Supabase auth user", error, { authId: user.authId });
    }

    // Clear the session cookie so the browser is not left holding a token for
    // an account that no longer exists.
    try {
      await (await createClient()).auth.signOut();
    } catch {
      // The auth user is already gone, so a failed sign-out is harmless.
    }
  }

  revalidatePath("/", "layout");
  redirect("/?deleted=1");
}
