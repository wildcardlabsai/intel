"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { OrgMemberRole } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import { renderEmail, sendEmail } from "@/lib/email/resend";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  canActOn,
  canManageTeam,
  countSeats,
  generateInvitationToken,
  getMembership,
  invitationExpiry,
} from "@/lib/services/team";

/**
 * Team management.
 *
 * Every action re-reads the actor's membership from the database before
 * deciding anything. Nothing is trusted from the form: the browser can say
 * whatever it likes about who it is and what role it holds.
 */

export type TeamResult = {
  ok: boolean;
  error?: string;
  message?: string;
  /** Set when an invitation was stored but no email could be sent. */
  inviteUrl?: string;
};

const roleSchema = z.enum(["ADMIN", "MEMBER"]);

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: roleSchema,
});

const createOrgSchema = z.object({
  name: z.string().trim().min(2, "Give the organisation a name").max(120),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Creates an organisation for a user who has none, making them its owner.
 * This is how a solo account becomes a team.
 */
export async function createOrganisation(formData: FormData): Promise<TeamResult> {
  const user = await requireUser("/dashboard/team");

  if (user.organisationId) {
    return { ok: false, error: "You already belong to an organisation." };
  }

  const parsed = createOrgSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the name." };
  }

  const base = slugify(parsed.data.name) || "team";
  let slug = base;
  // Slugs are unique; fall back to a suffixed variant rather than failing.
  for (let attempt = 1; attempt < 20; attempt += 1) {
    const taken = await prisma.organisation.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) break;
    slug = `${base}-${attempt + 1}`;
  }

  await prisma.$transaction(async (tx) => {
    const organisation = await tx.organisation.create({
      data: { name: parsed.data.name, slug, billingEmail: user.email },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { organisationId: organisation.id },
    });
    await tx.organisationMember.create({
      data: {
        organisationId: organisation.id,
        userId: user.id,
        role: "OWNER",
        acceptedAt: new Date(),
      },
    });
  });

  revalidatePath("/dashboard/team");
  return { ok: true, message: `“${parsed.data.name}” created. You are its owner.` };
}

export async function inviteMember(formData: FormData): Promise<TeamResult> {
  const user = await requireUser("/dashboard/team");
  if (!user.organisationId) return { ok: false, error: "You are not in an organisation." };

  const actorRole = await getMembership(user.organisationId, user.id);
  if (!canManageTeam(actorRole)) {
    return { ok: false, error: "Only an owner or admin can invite people." };
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  // Only an owner can create another admin.
  if (parsed.data.role === "ADMIN" && actorRole !== "OWNER") {
    return { ok: false, error: "Only the owner can invite an admin." };
  }

  const existingMember = await prisma.user.findFirst({
    where: { email: parsed.data.email, organisationId: user.organisationId },
    select: { id: true },
  });
  if (existingMember) {
    return { ok: false, error: "That person is already in your organisation." };
  }

  const entitlements = await getEntitlements(user);
  const seats = await countSeats(user.organisationId);
  if (entitlements.limits.seats !== -1 && seats >= entitlements.limits.seats) {
    return {
      ok: false,
      error:
        `Your ${entitlements.planName} plan includes ${entitlements.limits.seats} ` +
        `${entitlements.limits.seats === 1 ? "seat" : "seats"}, and ${seats} ` +
        `${seats === 1 ? "is" : "are"} in use. Pending invitations count as seats.`,
    };
  }

  const token = generateInvitationToken();
  const expiresAt = invitationExpiry();

  await prisma.organisationInvitation.upsert({
    where: {
      organisationId_email: { organisationId: user.organisationId, email: parsed.data.email },
    },
    create: {
      organisationId: user.organisationId,
      email: parsed.data.email,
      role: parsed.data.role as OrgMemberRole,
      tokenHash: token.hash,
      invitedByUserId: user.id,
      expiresAt,
    },
    // Re-inviting issues a fresh token and clears any earlier revocation.
    update: {
      role: parsed.data.role as OrgMemberRole,
      tokenHash: token.hash,
      invitedByUserId: user.id,
      expiresAt,
      revokedAt: null,
      acceptedAt: null,
    },
  });

  const inviteUrl = `${getEnv().APP_URL}/dashboard/team/accept?token=${token.plaintext}`;
  const organisation = await prisma.organisation.findUnique({
    where: { id: user.organisationId },
    select: { name: true },
  });

  const email = renderEmail({
    heading: `You have been invited to ${organisation?.name ?? "a team"}`,
    intro: `${user.name ?? user.email} has invited you to join their team on Cymru Intelligence.`,
    body:
      `<p style="margin:0 0 12px;">Accepting gives you access to their subscription. ` +
      `The invitation expires in 14 days.</p>`,
    ctaLabel: "Accept the invitation",
    ctaUrl: inviteUrl,
    footerNote: "If you were not expecting this, you can ignore it.",
  });

  const sent = await sendEmail({
    to: parsed.data.email,
    subject: `Join ${organisation?.name ?? "the team"} on Cymru Intelligence`,
    html: email.html,
    text: email.text,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorEmail: user.email,
      action: "team.invite",
      metadata: { role: parsed.data.role, emailSent: sent.sent },
    },
  });

  revalidatePath("/dashboard/team");

  if (!sent.sent) {
    logger.warn("invitation email not sent", { reason: sent.reason });
    // The invitation is real either way — hand the owner the link rather than
    // pretending an email went out.
    return {
      ok: true,
      message: "Invitation created, but no email could be sent. Share this link yourself:",
      inviteUrl,
    };
  }

  return { ok: true, message: `Invitation sent to ${parsed.data.email}.` };
}

export async function revokeInvitation(invitationId: string): Promise<TeamResult> {
  const user = await requireUser("/dashboard/team");
  if (!user.organisationId) return { ok: false, error: "You are not in an organisation." };

  const actorRole = await getMembership(user.organisationId, user.id);
  if (!canManageTeam(actorRole)) {
    return { ok: false, error: "Only an owner or admin can revoke an invitation." };
  }

  const invitation = await prisma.organisationInvitation.findUnique({
    where: { id: invitationId },
    select: { id: true, organisationId: true, email: true },
  });
  if (!invitation || invitation.organisationId !== user.organisationId) {
    return { ok: false, error: "Invitation not found." };
  }

  await prisma.organisationInvitation.update({
    where: { id: invitation.id },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/dashboard/team");
  return { ok: true, message: `Invitation to ${invitation.email} revoked.` };
}

export async function changeMemberRole(
  memberId: string,
  role: "ADMIN" | "MEMBER"
): Promise<TeamResult> {
  const user = await requireUser("/dashboard/team");
  if (!user.organisationId) return { ok: false, error: "You are not in an organisation." };

  const actorRole = await getMembership(user.organisationId, user.id);
  if (!actorRole || !canManageTeam(actorRole)) {
    return { ok: false, error: "Only an owner or admin can change roles." };
  }

  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success) return { ok: false, error: "Unknown role." };

  const member = await prisma.organisationMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { email: true } } },
  });
  if (!member || member.organisationId !== user.organisationId) {
    return { ok: false, error: "Member not found." };
  }

  if (member.userId === user.id) {
    return { ok: false, error: "You cannot change your own role." };
  }
  if (!canActOn(actorRole, member.role)) {
    return { ok: false, error: "You do not have permission to change that person's role." };
  }
  if (parsedRole.data === "ADMIN" && actorRole !== "OWNER") {
    return { ok: false, error: "Only the owner can make someone an admin." };
  }

  await prisma.organisationMember.update({
    where: { id: member.id },
    data: { role: parsedRole.data as OrgMemberRole },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorEmail: user.email,
      action: "team.role_changed",
      metadata: { member: member.user.email, role: parsedRole.data },
    },
  });

  revalidatePath("/dashboard/team");
  return { ok: true, message: `${member.user.email} is now ${parsedRole.data.toLowerCase()}.` };
}

export async function removeMember(memberId: string): Promise<TeamResult> {
  const user = await requireUser("/dashboard/team");
  if (!user.organisationId) return { ok: false, error: "You are not in an organisation." };

  const actorRole = await getMembership(user.organisationId, user.id);
  if (!actorRole || !canManageTeam(actorRole)) {
    return { ok: false, error: "Only an owner or admin can remove someone." };
  }

  const member = await prisma.organisationMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!member || member.organisationId !== user.organisationId) {
    return { ok: false, error: "Member not found." };
  }

  if (member.userId === user.id) {
    return { ok: false, error: "Use “Leave organisation” to remove yourself." };
  }
  if (member.role === "OWNER") {
    return { ok: false, error: "The owner cannot be removed. Transfer ownership first." };
  }
  if (!canActOn(actorRole, member.role)) {
    return { ok: false, error: "You do not have permission to remove that person." };
  }

  await prisma.$transaction([
    prisma.organisationMember.delete({ where: { id: member.id } }),
    // Their own data stays theirs; they simply lose the shared subscription.
    prisma.user.update({ where: { id: member.userId }, data: { organisationId: null } }),
    prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorEmail: user.email,
        action: "team.member_removed",
        metadata: { member: member.user.email },
      },
    }),
  ]);

  revalidatePath("/dashboard/team");
  return { ok: true, message: `${member.user.email} removed from the team.` };
}

/** Hands ownership to another member. The previous owner becomes an admin. */
export async function transferOwnership(memberId: string): Promise<TeamResult> {
  const user = await requireUser("/dashboard/team");
  if (!user.organisationId) return { ok: false, error: "You are not in an organisation." };

  const actorRole = await getMembership(user.organisationId, user.id);
  if (actorRole !== "OWNER") {
    return { ok: false, error: "Only the owner can transfer ownership." };
  }

  const member = await prisma.organisationMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { email: true } } },
  });
  if (!member || member.organisationId !== user.organisationId || member.userId === user.id) {
    return { ok: false, error: "Member not found." };
  }

  await prisma.$transaction([
    prisma.organisationMember.update({ where: { id: member.id }, data: { role: "OWNER" } }),
    prisma.organisationMember.update({
      where: { organisationId_userId: { organisationId: user.organisationId, userId: user.id } },
      data: { role: "ADMIN" },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorEmail: user.email,
        action: "team.ownership_transferred",
        metadata: { to: member.user.email },
      },
    }),
  ]);

  revalidatePath("/dashboard/team");
  return { ok: true, message: `${member.user.email} is now the owner.` };
}

export async function leaveOrganisation(): Promise<TeamResult> {
  const user = await requireUser("/dashboard/team");
  if (!user.organisationId) return { ok: false, error: "You are not in an organisation." };

  const actorRole = await getMembership(user.organisationId, user.id);
  if (actorRole === "OWNER") {
    return {
      ok: false,
      error: "Transfer ownership to someone else before leaving, so the team is not left without an owner.",
    };
  }

  await prisma.$transaction([
    prisma.organisationMember.delete({
      where: { organisationId_userId: { organisationId: user.organisationId, userId: user.id } },
    }),
    prisma.user.update({ where: { id: user.id }, data: { organisationId: null } }),
  ]);

  revalidatePath("/dashboard/team");
  return { ok: true, message: "You have left the organisation." };
}
