import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getEntitlements } from "@/lib/billing/plans";
import { countSeats, hashInvitationToken } from "@/lib/services/team";

export const metadata: Metadata = { title: "Accept invitation | Cymru Intelligence" };
export const dynamic = "force-dynamic";

/**
 * Accepts an organisation invitation.
 *
 * The invitation is looked up by the hash of the token, never by the token
 * itself, and is only honoured for the email address it was issued to — a
 * leaked link cannot be redeemed by someone else. The seat limit is re-checked
 * at acceptance because the team may have filled up since the invite was sent.
 */
export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const user = await requireUser(
    `/dashboard/team/accept${token ? `?token=${encodeURIComponent(token)}` : ""}`
  );

  const outcome = await accept(token, user.id, user.email);

  return (
    <>
      <PageHeader eyebrow="Team" title={outcome.title} />
      <Card>
        <CardContent className="p-6">
          <p className="max-w-2xl text-sm leading-relaxed text-muted">{outcome.detail}</p>
          <Button asChild className="mt-4">
            <Link href={outcome.ok ? "/dashboard/team" : "/dashboard"}>
              {outcome.ok ? "Go to the team" : "Back to dashboard"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

type Outcome = { ok: boolean; title: string; detail: string };

async function accept(
  token: string | undefined,
  userId: string,
  email: string
): Promise<Outcome> {
  if (!token) {
    return {
      ok: false,
      title: "No invitation token",
      detail: "That link is missing its token. Ask whoever invited you to send it again.",
    };
  }

  const invitation = await prisma.organisationInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
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
    return {
      ok: false,
      title: "Already accepted",
      detail: "This invitation has already been used.",
    };
  }

  if (invitation.expiresAt <= new Date()) {
    return {
      ok: false,
      title: "Invitation expired",
      detail: "Invitations are valid for 14 days. Ask whoever invited you to send a new one.",
    };
  }

  // The invitation belongs to an email address, not to whoever holds the link.
  if (invitation.email.toLowerCase() !== email.toLowerCase()) {
    return {
      ok: false,
      title: "This invitation is for a different account",
      detail: `It was sent to ${invitation.email}. Sign in with that address to accept it.`,
    };
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
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
    // The pending invitation itself is one of the counted seats, so a team at
    // its limit only blocks acceptance when it is over it.
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
        userId,
        role: invitation.role,
        invitedEmail: invitation.email,
        invitedAt: invitation.createdAt,
        acceptedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { organisationId: invitation.organisationId },
    }),
    prisma.organisationInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: userId,
        actorEmail: email,
        action: "team.invitation_accepted",
        metadata: { organisation: invitation.organisation.name },
      },
    }),
  ]);

  return {
    ok: true,
    title: `Welcome to ${invitation.organisation.name}`,
    detail:
      "You now have access under this organisation's subscription. Your saved companies, " +
      "searches and alerts remain your own.",
  };
}
