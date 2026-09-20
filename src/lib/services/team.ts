import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { OrgMemberRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

/**
 * Organisation membership.
 *
 * A seat is a person who can sign in under the organisation's subscription:
 * an accepted member, or a pending invitation that has not expired. Counting
 * pending invitations against the seat limit is deliberate — otherwise an
 * owner could invite twenty people onto a five-seat plan and only discover the
 * problem when they tried to sign in.
 *
 * Invitation tokens are stored only as a SHA-256 hash. The plaintext exists in
 * the emailed link and nowhere else, so a database leak cannot be used to join
 * an organisation.
 */

export const INVITATION_TTL_DAYS = 14;

export type Seat = {
  kind: "member" | "invitation";
  id: string;
  email: string;
  name: string | null;
  role: OrgMemberRole;
  joinedAt: Date | null;
  invitedAt: Date | null;
  expiresAt: Date | null;
  isYou: boolean;
};

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateInvitationToken(): { plaintext: string; hash: string } {
  const plaintext = randomBytes(32).toString("base64url");
  return { plaintext, hash: hashInvitationToken(plaintext) };
}

/** Constant-time comparison, so a token cannot be recovered by timing. */
export function invitationTokenMatches(token: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashInvitationToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

export function invitationExpiry(from = new Date()): Date {
  return new Date(from.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Owners and admins may manage the team; members may not. */
export function canManageTeam(role: OrgMemberRole | null): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Whether `actor` may change `target`'s role or remove them.
 *
 * An admin can manage members but not other admins or the owner, so one admin
 * cannot lock another out. Only an owner can promote to or demote from admin.
 */
export function canActOn(actor: OrgMemberRole, target: OrgMemberRole): boolean {
  if (actor === "OWNER") return true;
  if (actor === "ADMIN") return target === "MEMBER";
  return false;
}

export async function getSeats(
  organisationId: string,
  currentUserId: string
): Promise<Seat[]> {
  const now = new Date();

  const [members, invitations] = await Promise.all([
    prisma.organisationMember.findMany({
      where: { organisationId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.organisationInvitation.findMany({
      where: { organisationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const memberSeats: Seat[] = members.map((member) => ({
    kind: "member",
    id: member.id,
    email: member.user.email,
    name: member.user.name,
    role: member.role,
    joinedAt: member.acceptedAt ?? member.createdAt,
    invitedAt: member.invitedAt,
    expiresAt: null,
    isYou: member.userId === currentUserId,
  }));

  const invitationSeats: Seat[] = invitations.map((invitation) => ({
    kind: "invitation",
    id: invitation.id,
    email: invitation.email,
    name: null,
    role: invitation.role,
    joinedAt: null,
    invitedAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    isYou: false,
  }));

  return [...memberSeats, ...invitationSeats];
}

/** Members plus live invitations — what a seat limit is measured against. */
export async function countSeats(organisationId: string): Promise<number> {
  const now = new Date();
  const [members, invitations] = await Promise.all([
    prisma.organisationMember.count({ where: { organisationId } }),
    prisma.organisationInvitation.count({
      where: { organisationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
    }),
  ]);
  return members + invitations;
}

export async function getMembership(
  organisationId: string,
  userId: string
): Promise<OrgMemberRole | null> {
  const membership = await prisma.organisationMember.findUnique({
    where: { organisationId_userId: { organisationId, userId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}
