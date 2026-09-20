import type { Metadata } from "next";
import Link from "next/link";

import { AcceptInvitation } from "@/app/dashboard/team/accept/accept-ui";
import { previewInvitation } from "@/app/dashboard/team/accept/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Accept invitation | Cymru Intelligence" };
export const dynamic = "force-dynamic";

/**
 * Shows an invitation and offers to accept it.
 *
 * Rendering this page changes nothing. Joining happens only when the button is
 * pressed, so a prefetch, a link preview or a scanner following the emailed
 * link cannot consume the invitation.
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

  if (!token) {
    return (
      <Outcome
        title="No invitation token"
        detail="That link is missing its token. Ask whoever invited you to send it again."
      />
    );
  }

  const preview = await previewInvitation(token);

  if (preview.problem || !preview.organisationName) {
    return <Outcome title="This invitation cannot be used" detail={preview.problem ?? "Not found."} />;
  }

  // An invitation belongs to an email address, not to whoever holds the link.
  if (preview.email && preview.email.toLowerCase() !== user.email.toLowerCase()) {
    return (
      <Outcome
        title="This invitation is for a different account"
        detail={`It was sent to ${preview.email}. Sign in with that address to accept it.`}
      />
    );
  }

  return (
    <>
      <PageHeader eyebrow="Team" title={`Join ${preview.organisationName}`} />
      <Card>
        <CardContent className="p-6">
          <AcceptInvitation token={token} organisationName={preview.organisationName} />
        </CardContent>
      </Card>
    </>
  );
}

function Outcome({ title, detail }: { title: string; detail: string }) {
  return (
    <>
      <PageHeader eyebrow="Team" title={title} />
      <Card>
        <CardContent className="p-6">
          <p className="max-w-2xl text-sm leading-relaxed text-muted">{detail}</p>
          <Button asChild className="mt-4">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
