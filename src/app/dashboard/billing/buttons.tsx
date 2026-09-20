"use client";

import { useState, useTransition } from "react";

import { openBillingPortal, startCheckout } from "@/app/dashboard/billing/actions";
import { Button } from "@/components/ui/button";

export function CheckoutButton({ planCode, planName }: { planCode: string; planName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <Button
        type="button"
        className="w-full"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            // A successful checkout redirects, so anything returned is an error.
            const result = await startCheckout(planCode, "monthly");
            if (result?.error) setError(result.error);
          })
        }
      >
        {isPending ? "Opening checkout…" : `Choose ${planName}`}
      </Button>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function PortalButton() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="text-right">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await openBillingPortal();
            if (result?.error) setError(result.error);
          })
        }
      >
        {isPending ? "Opening…" : "Manage billing"}
      </Button>
      {error && <p className="mt-2 max-w-xs text-xs text-red-700">{error}</p>}
    </div>
  );
}
