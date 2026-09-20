import "server-only";

import type { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

/**
 * Development-only sign-in, for previewing the product without Supabase.
 *
 * This is an authentication bypass, so it is gated as tightly as it can be:
 *
 *  - `process.env.NODE_ENV === "development"` is required. Next.js sets that
 *    only for `next dev`; a production build inlines "production", so this
 *    branch is unreachable — and eliminated — in anything you would deploy.
 *  - `DEV_AUTH_EMAIL` must be set explicitly. Running `next dev` is not on its
 *    own enough to sign anyone in.
 *  - It only ever matches a user that already exists in the database, so it
 *    cannot conjure an account, and it can never reach a real user because a
 *    real deployment never runs in development mode.
 *
 * It exists so a reviewer can see the real application rather than a mockup.
 * It is never a way into a deployed environment.
 */

export function devAuthEmail(): string | null {
  if (process.env.NODE_ENV !== "development") return null;

  const email = process.env.DEV_AUTH_EMAIL?.trim();
  return email && email.length > 0 ? email.toLowerCase() : null;
}

export function isDevAuthEnabled(): boolean {
  return devAuthEmail() !== null;
}

/** Loads the impersonated user, or null when dev auth is not enabled. */
export async function getDevSessionUser(): Promise<SessionUser | null> {
  const email = devAuthEmail();
  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email },
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

  if (!user || user.deletedAt) {
    logger.warn("DEV_AUTH_EMAIL is set but matches no user", { email });
    return null;
  }

  logger.warn("development authentication in use — never enable this outside next dev", {
    email,
    role: user.role,
  });

  return {
    id: user.id,
    authId: user.authId,
    email: user.email,
    name: user.name,
    role: user.role,
    organisationId: user.organisationId,
    organisationName: user.organisation?.name ?? null,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  };
}
