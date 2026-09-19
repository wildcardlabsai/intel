import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import type { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { getEnv, isConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

/**
 * Session and authorisation helpers.
 *
 * Supabase owns credentials; this module mirrors the authenticated user into
 * our `users` table on first sight and returns the product-level user with
 * their role, organisation and subscription attached.
 *
 * Every helper is server-only. Subscription state is always read from the
 * database, never from anything the browser sent.
 */

export type SessionUser = {
  id: string;
  authId: string;
  email: string;
  name: string | null;
  role: UserRole;
  organisationId: string | null;
  organisationName: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

const ADMIN_ROLES: UserRole[] = ["ADMIN", "SUPER_ADMIN"];

/**
 * Returns the signed-in user, or null. Cached per request so that a page and
 * its nested layouts do not each hit the database.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  if (!isConfigured("supabase")) return null;

  let authUser;
  try {
    const supabase = await createClient();
    // getUser() revalidates the JWT with Supabase; getSession() would trust a
    // cookie the browser could have tampered with.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    authUser = data.user;
  } catch (error) {
    logger.warn("failed to read Supabase session", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  const email = authUser.email;
  if (!email) return null;

  const existing = await prisma.user.findUnique({
    where: { authId: authUser.id },
    select: {
      id: true,
      authId: true,
      email: true,
      name: true,
      role: true,
      organisationId: true,
      emailVerifiedAt: true,
      createdAt: true,
      deletedAt: true,
      organisation: { select: { name: true } },
    },
  });

  if (existing) {
    if (existing.deletedAt) return null;

    // Keep the mirrored email and verification state current.
    const emailVerifiedAt = authUser.email_confirmed_at
      ? new Date(authUser.email_confirmed_at)
      : existing.emailVerifiedAt;

    if (existing.email !== email || emailVerifiedAt?.getTime() !== existing.emailVerifiedAt?.getTime()) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { email, emailVerifiedAt, lastSeenAt: new Date() },
      });
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date() },
      });
    }

    return {
      id: existing.id,
      authId: existing.authId,
      email,
      name: existing.name,
      role: existing.role,
      organisationId: existing.organisationId,
      organisationName: existing.organisation?.name ?? null,
      emailVerifiedAt,
      createdAt: existing.createdAt,
    };
  }

  // First sight of this auth user — create the product-level row.
  const env = getEnv();
  const isBootstrapAdmin =
    Boolean(env.ADMIN_BOOTSTRAP_EMAIL) &&
    email.toLowerCase() === env.ADMIN_BOOTSTRAP_EMAIL?.toLowerCase();

  const metadataName =
    typeof authUser.user_metadata?.name === "string" ? authUser.user_metadata.name : null;

  const created = await prisma.user.create({
    data: {
      authId: authUser.id,
      email,
      name: metadataName,
      role: isBootstrapAdmin ? "SUPER_ADMIN" : "USER",
      emailVerifiedAt: authUser.email_confirmed_at ? new Date(authUser.email_confirmed_at) : null,
      lastSeenAt: new Date(),
    },
    select: {
      id: true,
      authId: true,
      email: true,
      name: true,
      role: true,
      organisationId: true,
      emailVerifiedAt: true,
      createdAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: created.id,
      actorEmail: created.email,
      action: "user.created",
      entityType: "user",
      entityId: created.id,
      metadata: { bootstrapAdmin: isBootstrapAdmin },
    },
  });

  return { ...created, organisationName: null };
});

/** Redirects to sign-in when there is no session. */
export async function requireUser(redirectTo = "/dashboard"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(redirectTo)}`);
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (!ADMIN_ROLES.includes(user.role)) {
    redirect("/dashboard?error=forbidden");
  }
  return user;
}

export function isAdmin(user: { role: UserRole } | null): boolean {
  return Boolean(user && ADMIN_ROLES.includes(user.role));
}

/**
 * The organisation a user's entitlements are billed against. Solo users have
 * no organisation and are billed individually.
 */
export async function getBillingScope(user: SessionUser): Promise<{
  organisationId: string | null;
  userId: string;
}> {
  return { organisationId: user.organisationId, userId: user.id };
}
