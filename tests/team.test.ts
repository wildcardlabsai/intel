import { describe, expect, it } from "vitest";

import {
  INVITATION_TTL_DAYS,
  canActOn,
  canManageTeam,
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  invitationTokenMatches,
} from "@/lib/services/team";

describe("invitation tokens", () => {
  it("never stores the plaintext in the hash", () => {
    const token = generateInvitationToken();
    expect(token.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(token.hash).not.toContain(token.plaintext);
  });

  it("produces a different token every time", () => {
    const first = generateInvitationToken();
    const second = generateInvitationToken();
    expect(first.plaintext).not.toBe(second.plaintext);
    expect(first.hash).not.toBe(second.hash);
  });

  it("hashes deterministically so a link can be looked up", () => {
    const token = generateInvitationToken();
    expect(hashInvitationToken(token.plaintext)).toBe(token.hash);
  });

  it("matches only the token that produced the hash", () => {
    const token = generateInvitationToken();
    expect(invitationTokenMatches(token.plaintext, token.hash)).toBe(true);
    expect(invitationTokenMatches("not-the-token", token.hash)).toBe(false);
  });

  it("rejects a malformed stored hash without throwing", () => {
    const token = generateInvitationToken();
    expect(invitationTokenMatches(token.plaintext, "short")).toBe(false);
    expect(invitationTokenMatches(token.plaintext, "")).toBe(false);
  });

  it("is URL-safe, so the link survives being emailed", () => {
    for (let index = 0; index < 20; index += 1) {
      const token = generateInvitationToken();
      expect(token.plaintext).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(encodeURIComponent(token.plaintext)).toBe(token.plaintext);
    }
  });
});

describe("invitationExpiry", () => {
  it("expires the documented number of days after issue", () => {
    const from = new Date("2026-09-20T00:00:00.000Z");
    const expiry = invitationExpiry(from);
    const days = (expiry.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(INVITATION_TTL_DAYS);
  });

  it("is always in the future relative to its issue time", () => {
    expect(invitationExpiry().getTime()).toBeGreaterThan(Date.now());
  });
});

describe("canManageTeam", () => {
  it("allows owners and admins", () => {
    expect(canManageTeam("OWNER")).toBe(true);
    expect(canManageTeam("ADMIN")).toBe(true);
  });

  it("refuses members and non-members", () => {
    expect(canManageTeam("MEMBER")).toBe(false);
    expect(canManageTeam(null)).toBe(false);
  });
});

describe("canActOn", () => {
  it("lets an owner act on anyone", () => {
    expect(canActOn("OWNER", "OWNER")).toBe(true);
    expect(canActOn("OWNER", "ADMIN")).toBe(true);
    expect(canActOn("OWNER", "MEMBER")).toBe(true);
  });

  it("stops one admin locking out another, or the owner", () => {
    expect(canActOn("ADMIN", "MEMBER")).toBe(true);
    expect(canActOn("ADMIN", "ADMIN")).toBe(false);
    expect(canActOn("ADMIN", "OWNER")).toBe(false);
  });

  it("gives a plain member no authority at all", () => {
    expect(canActOn("MEMBER", "MEMBER")).toBe(false);
    expect(canActOn("MEMBER", "OWNER")).toBe(false);
  });
});
