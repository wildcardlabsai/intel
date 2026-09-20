import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";

import {
  CreateOrganisationForm,
  InviteForm,
  LeaveOrganisationButton,
  SeatList,
  type SeatView,
} from "@/app/dashboard/team/team-ui";
import { NotConfigured } from "@/components/source-attribution";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import { getIntegrationStatuses } from "@/lib/env";
import { canManageTeam, getMembership, getSeats } from "@/lib/services/team";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Team | Cymru Intelligence" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await requireUser("/dashboard/team");
  const entitlements = await getEntitlements(user);

  if (!user.organisationId) {
    return (
      <>
        <PageHeader
          eyebrow="Workspace"
          title="Team"
          description="Share one subscription across colleagues. Everyone keeps their own saved companies, searches and alerts."
        />

        {entitlements.limits.seats === 1 ? (
          <Card>
            <CardContent className="p-6">
              <Badge tone="warning">Single seat</Badge>
              <h3 className="mt-3 text-base font-bold text-ink-900">
                Your {entitlements.planName} plan includes one seat
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                Team accounts are available on Business and above. You can still create an
                organisation now — you just will not be able to invite anyone until the plan
                includes more than one seat.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/dashboard/billing">View plans</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Create an organisation</CardTitle>
            <p className="mt-1 text-sm text-muted">
              You become its owner. Billing moves to the organisation, and you can invite up to{" "}
              {entitlements.limits.seats === -1
                ? "any number of"
                : entitlements.limits.seats}{" "}
              people including yourself.
            </p>
          </CardHeader>
          <CardContent>
            <CreateOrganisationForm />
          </CardContent>
        </Card>
      </>
    );
  }

  const [organisation, actorRole, seats, resend] = await Promise.all([
    prisma.organisation.findUnique({
      where: { id: user.organisationId },
      select: { name: true },
    }),
    getMembership(user.organisationId, user.id),
    getSeats(user.organisationId, user.id),
    Promise.resolve(getIntegrationStatuses().find((status) => status.key === "resend")),
  ]);

  const seatViews: SeatView[] = seats.map((seat) => ({
    kind: seat.kind,
    id: seat.id,
    email: seat.email,
    name: seat.name,
    role: seat.role,
    joinedAt: seat.joinedAt ? formatDate(seat.joinedAt) : null,
    expiresAt: seat.expiresAt ? formatDate(seat.expiresAt) : null,
    isYou: seat.isYou,
  }));

  const limit = entitlements.limits.seats;
  const used = seats.length;
  const full = limit !== -1 && used >= limit;

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title={organisation?.name ?? "Team"}
        description="Everyone here shares the organisation's subscription. Saved companies, searches and alerts stay with each person."
        actions={
          <Badge tone={full ? "warning" : "neutral"}>
            {used}
            {limit === -1 ? "" : ` / ${limit}`} {used === 1 ? "seat" : "seats"}
          </Badge>
        }
      />

      {canManageTeam(actorRole) && !resend?.configured && (
        <NotConfigured
          title="Invitation emails cannot be sent"
          integration="invitation email"
          missingEnvVars={resend?.missingEnvVars ?? []}
          impact="Invitations are still created, and the link is shown to you so you can share it yourself."
          docsUrl={resend?.docsUrl}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>People</CardTitle>
          <p className="mt-1 text-sm text-muted">
            A pending invitation occupies a seat until it is accepted, revoked or expires.
          </p>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {seatViews.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" strokeWidth={1.5} />}
              title="No one here yet"
              description="Invite a colleague to share this subscription."
            />
          ) : (
            <SeatList seats={seatViews} actorRole={actorRole} />
          )}
        </CardContent>
      </Card>

      {canManageTeam(actorRole) && (
        <Card>
          <CardHeader>
            <CardTitle>Invite someone</CardTitle>
            <p className="mt-1 text-sm text-muted">
              {full
                ? `Every seat on your ${entitlements.planName} plan is in use. Free a seat or upgrade to invite anyone else.`
                : "They will get a link that expires in 14 days. It only works for the address you send it to."}
            </p>
          </CardHeader>
          <CardContent>
            {full ? (
              <Button asChild variant="outline">
                <Link href="/dashboard/billing">View plans</Link>
              </Button>
            ) : (
              <InviteForm canInviteAdmin={actorRole === "OWNER"} />
            )}
          </CardContent>
        </Card>
      )}

      {actorRole !== "OWNER" && (
        <Card>
          <CardHeader>
            <CardTitle>Leave this organisation</CardTitle>
          </CardHeader>
          <CardContent>
            <LeaveOrganisationButton />
          </CardContent>
        </Card>
      )}
    </>
  );
}
