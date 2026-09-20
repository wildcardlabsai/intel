"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import { countSeats, hashInvitationToken } from "@/lib/services/team";

/**
 * Accepting an organisation invitation.
 *
 * Deliberately an action rather than something the page does while rendering:
 * joining an organisation is a state change, and a state change must not
 * happen because a URL was loaded. A link prefetch, a preview fetch or a
 * scanner following the link would otherwise consume the invitation without
 * anyone deciding anything.
 *
 * The invitation is found by the hash of the token, never the token itself,
 * and is only honoured for the email address it was issued to — so a forwarded
 * link cannot be redeemed by whoever received it.
 */

export type AcceptResult = { ok: boolean; title: string; detail: string };

const tokenSchema = z.string().trim().min(10).max(200);

export async function acceptInvitation(token: string): Promise<AcceptResult> {
  const user = await requireUser("/dashboard/team");

  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) {
    return {
      ok: false,
      title: "That invitation link is not valid",
      detail: "Ask whoever invited you to send it again.",
    };
  }

  const invitation = await prisma.organisationInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(parsed.data) },
    include: { organisation: { select: { id: true, name: true } } },
  });

  if (!invitation || invitation.revokedAt) {
    return {
      ok: false,
      title: "Invitation not found",
      detail: "This invitation does not exist or has been revoked. Ask for a new one.",
    };
  }

  if (invitation.acceptedAt) {
    return { ok: false, title: "Already accepted", detail: "This invitation has already been used." };
  }

  if (invitation.expiresAt <= new Date()) {
    return {
      ok: false,
      title: "Invitation expired",
      detail: "Invitations are valid for 14 days. Ask whoever invited you to send a new one.",
    };
  }

  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    return {
      ok: false,
      title: "This invitation is for a different account",
      detail: `It was sent to ${invitation.email}. Sign in with that address to accept it.`,
    };
  }

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organisationId: true },
  });
  if (existing?.organisationId && existing.organisationId !== invitation.organisationId) {
    return {
      ok: false,
      title: "You are already in an organisation",
      detail:
        "Leave your current organisation before accepting this invitation. " +
        "You can do that from the team page.",
    };
  }

  // The team may have filled up since the invitation was sent, so the seat
  // limit is re-checked here rather than trusted from when it was issued.
  const owner = await prisma.organisationMember.findFirst({
    where: { organisationId: invitation.organisationId, role: "OWNER" },
    include: { user: true },
  });

  if (owner) {
    const entitlements = await getEntitlements({
      id: owner.user.id,
      authId: owner.user.authId,
      email: owner.user.email,
      name: owner.user.name,
      role: owner.user.role,
      organisationId: invitation.organisationId,
      organisationName: invitation.organisation.name,
      emailVerifiedAt: owner.user.emailVerifiedAt,
      createdAt: owner.user.createdAt,
    });

    const seats = await countSeats(invitation.organisationId);
    // This pending invitation is itself one of the counted seats, so a team at
    // exactly its limit is fine; only one over it is not.
    if (entitlements.limits.seats !== -1 && seats > entitlements.limits.seats) {
      return {
        ok: false,
        title: "That team is full",
        detail:
          `${invitation.organisation.name} has no seats left on its ${entitlements.planName} ` +
          "plan. Ask the owner to upgrade or free a seat, then try again.",
      };
    }
  }

  await prisma.$transaction([
    prisma.organisationMember.create({
      data: {
        organisationId: invitation.organisationId,
        userId: user.id,
        role: invitation.role,
        invitedEmail: invitation.email,
        invitedAt: invitation.createdAt,
        acceptedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { organisationId: invitation.organisationId },
    }),
    prisma.organisationInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorEmail: user.email,
        action: "team.invitation_accepted",
        metadata: { organisation: invitation.organisation.name },
      },
    }),
  ]);

  revalidatePath("/dashboard/team");

  return {
    ok: true,
    title: `Welcome to ${invitation.organisation.name}`,
    detail:
      "You now have access under this organisation's subscription. Your saved companies, " +
      "searches and alerts remain your own.",
  };
}

/**
 * Describes an invitation without consuming it, so the page can show who is
 * inviting you before you decide.
 */
export async function previewInvitation(token: string): Promise<{
  organisationName: string | null;
  email: string | null;
  problem: string | null;
}> {
  await requireUser("/dashboard/team");

  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { organisationName: null, email: null, problem: "That link is not valid." };

  const invitation = await prisma.organisationInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(parsed.data) },
    include: { organisation: { select: { name: true } } },
  });

  if (!invitation || invitation.revokedAt) {
    return { organisationName: null, email: null, problem: "This invitation no longer exists." };
  }
  if (invitation.acceptedAt) {
    return {
      organisationName: invitation.organisation.name,
      email: invitation.email,
      problem: "This invitation has already been used.",
    };
  }
  if (invitation.expiresAt <= new Date()) {
    return {
      organisationName: invitation.organisation.name,
      email: invitation.email,
      problem: "This invitation has expired.",
    };
  }

  return {
    organisationName: invitation.organisation.name,
    email: invitation.email,
    problem: null,
  };
}
