"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { generateApiKey } from "@/lib/api/auth";
import { getEntitlements } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";

export type CreateKeyResult =
  | { ok: true; plaintext: string; prefix: string }
  | { ok: false; error: string };

const nameSchema = z.string().trim().min(2, "Give the key a name").max(60);

/**
 * Creates an API key. The plaintext is returned once and never stored — only
 * its SHA-256 hash is persisted.
 */
export async function createApiKey(formData: FormData): Promise<CreateKeyResult> {
  const user = await requireUser("/dashboard/api");

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name." };
  }

  const entitlements = await getEntitlements(user);
  if (!entitlements.limits.apiAccess) {
    return {
      ok: false,
      error: `API access is not included in the ${entitlements.planName} plan. Upgrade to Business or Enterprise.`,
    };
  }

  const existingCount = await prisma.apiKey.count({
    where: { userId: user.id, revokedAt: null },
  });
  if (existingCount >= 10) {
    return { ok: false, error: "You already have 10 active keys. Revoke one before creating another." };
  }

  const generated = generateApiKey();

  await prisma.apiKey.create({
    data: {
      name: parsed.data,
      prefix: generated.prefix,
      hashedKey: generated.hashedKey,
      userId: user.id,
      organisationId: user.organisationId,
      rateLimitPerMinute: entitlements.planCode === "ENTERPRISE" ? 300 : 60,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorEmail: user.email,
      action: "api_key.created",
      entityType: "api_key",
      metadata: { prefix: generated.prefix, name: parsed.data },
    },
  });

  revalidatePath("/dashboard/api");
  return { ok: true, plaintext: generated.plaintext, prefix: generated.prefix };
}

/**
 * Revokes a key. The row is kept so past usage stays attributable; only the
 * key stops working.
 */
export async function revokeApiKey(keyId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser("/dashboard/api");

  const key = await prisma.apiKey.findUnique({
    where: { id: keyId },
    select: { id: true, userId: true, prefix: true },
  });

  // Ownership check: a key id from the client must never be enough on its own.
  if (!key || key.userId !== user.id) {
    return { ok: false, error: "That key was not found." };
  }

  await prisma.apiKey.update({
    where: { id: key.id },
    data: { revokedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorEmail: user.email,
      action: "api_key.revoked",
      entityType: "api_key",
      entityId: key.id,
      metadata: { prefix: key.prefix },
    },
  });

  revalidatePath("/dashboard/api");
  return { ok: true };
}
