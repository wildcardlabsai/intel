"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { acceptInvitation, type AcceptResult } from "@/app/dashboard/team/accept/actions";
import { Button } from "@/components/ui/button";

/**
 * Accepting is an explicit choice, not something a page load does. The button
 * is what joins the organisation.
 */
export function AcceptInvitation({
  token,
  organisationName,
}: {
  token: string;
  organisationName: string;
}) {
  const router = useRouter();
  const [result, setResult] = useState<AcceptResult | null>(null);
  const [isPending, startTransition] = useTransition();

  if (result) {
    return (
      <div>
        <h2 className="text-base font-bold text-ink-900">{result.title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{result.detail}</p>
        <Button asChild className="mt-4">
          <Link href={result.ok ? "/dashboard/team" : "/dashboard"}>
            {result.ok ? "Go to the team" : "Back to dashboard"}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="max-w-2xl text-sm leading-relaxed text-muted">
        Joining <span className="font-semibold text-ink-900">{organisationName}</span> gives you
        access under their subscription. Your saved companies, searches and alerts stay with your
        own account, and you can leave at any time.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const outcome = await acceptInvitation(token);
              setResult(outcome);
              if (outcome.ok) router.refresh();
            })
          }
        >
          {isPending ? "Joining…" : `Join ${organisationName}`}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/dashboard">Not now</Link>
        </Button>
      </div>
    </div>
  );
}
