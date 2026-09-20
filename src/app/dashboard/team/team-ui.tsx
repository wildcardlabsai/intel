"use client";

import { useState, useTransition } from "react";
import { Crown, Mail, Shield, Trash2, UserMinus } from "lucide-react";

import {
  changeMemberRole,
  createOrganisation,
  inviteMember,
  leaveOrganisation,
  removeMember,
  revokeInvitation,
  transferOwnership,
  type TeamResult,
} from "@/app/dashboard/team/actions";
import { Button } from "@/components/ui/button";
import { Badge, Input, Label, Select } from "@/components/ui/primitives";

export type SeatView = {
  kind: "member" | "invitation";
  id: string;
  email: string;
  name: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: string | null;
  expiresAt: string | null;
  isYou: boolean;
};

function useTeamAction() {
  const [result, setResult] = useState<TeamResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<TeamResult>) {
    startTransition(async () => {
      setResult(await action());
    });
  }

  return { result, setResult, isPending, run };
}

function Feedback({ result }: { result: TeamResult | null }) {
  if (!result) return null;
  if (!result.ok) return <p className="mt-2 text-sm text-red-700">{result.error}</p>;

  return (
    <div className="mt-2 text-sm text-accent-green">
      <p>{result.message}</p>
      {result.inviteUrl && (
        <code className="mt-1 block break-all rounded bg-cream px-2 py-1.5 font-mono text-xs text-ink-900">
          {result.inviteUrl}
        </code>
      )}
    </div>
  );
}

/** Shown when the user has no organisation yet. */
export function CreateOrganisationForm() {
  const { result, isPending, run } = useTeamAction();
  const [name, setName] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set("name", name);
        run(() => createOrganisation(formData));
      }}
    >
      <Label htmlFor="org-name">Organisation name</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="org-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your company or team name"
          className="max-w-sm"
        />
        <Button type="submit" disabled={isPending || name.trim().length < 2}>
          {isPending ? "Creating…" : "Create organisation"}
        </Button>
      </div>
      <Feedback result={result} />
    </form>
  );
}

export function InviteForm({ canInviteAdmin }: { canInviteAdmin: boolean }) {
  const { result, isPending, run } = useTeamAction();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set("email", email);
        formData.set("role", role);
        run(() => inviteMember(formData));
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <Label htmlFor="invite-email">Email address</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="colleague@example.com"
          />
        </div>
        <div className="min-w-[140px]">
          <Label htmlFor="invite-role">Role</Label>
          <Select
            id="invite-role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="MEMBER">Member</option>
            {canInviteAdmin && <option value="ADMIN">Admin</option>}
          </Select>
        </div>
        <Button type="submit" disabled={isPending || email.trim().length === 0}>
          <Mail className="h-4 w-4" />
          {isPending ? "Inviting…" : "Send invitation"}
        </Button>
      </div>
      <Feedback result={result} />
    </form>
  );
}

export function SeatList({
  seats,
  actorRole,
}: {
  seats: SeatView[];
  actorRole: "OWNER" | "ADMIN" | "MEMBER" | null;
}) {
  const { result, isPending, run } = useTeamAction();

  const canManage = actorRole === "OWNER" || actorRole === "ADMIN";

  return (
    <div>
      <ul className="divide-y divide-border/60">
        {seats.map((seat) => {
          // An admin may act on members only, so one admin cannot lock out another.
          const actionable =
            canManage &&
            !seat.isYou &&
            seat.role !== "OWNER" &&
            (actorRole === "OWNER" || seat.role === "MEMBER");

          return (
            <li
              key={`${seat.kind}-${seat.id}`}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink-900">{seat.name ?? seat.email}</span>
                  <RoleBadge role={seat.role} />
                  {seat.kind === "invitation" && <Badge tone="warning">Invited</Badge>}
                  {seat.isYou && <Badge tone="info">You</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {seat.name ? `${seat.email} · ` : ""}
                  {seat.kind === "invitation"
                    ? `Invitation expires ${seat.expiresAt}`
                    : `Joined ${seat.joinedAt}`}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1">
                {seat.kind === "invitation" && canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => run(() => revokeInvitation(seat.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                    Revoke
                  </Button>
                )}

                {seat.kind === "member" && actionable && (
                  <>
                    {actorRole === "OWNER" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          run(() =>
                            changeMemberRole(seat.id, seat.role === "ADMIN" ? "MEMBER" : "ADMIN")
                          )
                        }
                      >
                        <Shield className="h-4 w-4" />
                        {seat.role === "ADMIN" ? "Make member" : "Make admin"}
                      </Button>
                    )}

                    {actorRole === "OWNER" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => run(() => transferOwnership(seat.id))}
                        title="Hand ownership to this person; you become an admin"
                      >
                        <Crown className="h-4 w-4" />
                        Make owner
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => run(() => removeMember(seat.id))}
                    >
                      <UserMinus className="h-4 w-4" />
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <Feedback result={result} />
    </div>
  );
}

export function LeaveOrganisationButton() {
  const { result, isPending, run } = useTeamAction();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <>
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
          Leave organisation
        </Button>
        <Feedback result={result} />
      </>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted">
        You will lose access to this organisation&rsquo;s subscription. Your saved companies,
        searches and alerts stay with your account.
      </p>
      <div className="mt-2 flex gap-2">
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={isPending}
          onClick={() => run(() => leaveOrganisation())}
        >
          Yes, leave
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
      <Feedback result={result} />
    </div>
  );
}

function RoleBadge({ role }: { role: "OWNER" | "ADMIN" | "MEMBER" }) {
  if (role === "OWNER") return <Badge tone="dark">Owner</Badge>;
  if (role === "ADMIN") return <Badge tone="info">Admin</Badge>;
  return <Badge tone="neutral">Member</Badge>;
}
