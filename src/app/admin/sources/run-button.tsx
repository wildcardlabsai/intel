"use client";

import { useState, useTransition } from "react";
import { Play } from "lucide-react";

import { runConnectorNow, type AdminActionResult } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function RunConnectorButton({
  connectorKey,
  label,
  disabled,
}: {
  connectorKey: string;
  label: string;
  disabled?: boolean;
}) {
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="text-right">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || isPending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            setResult(await runConnectorNow(connectorKey));
          })
        }
      >
        <Play className="h-3.5 w-3.5" />
        {isPending ? "Running…" : label}
      </Button>
      {result && (
        <p
          className={`mt-1.5 max-w-xs text-xs ${result.ok ? "text-emerald-800" : "text-red-700"}`}
        >
          {result.message}
          {result.detail && <span className="block text-muted">{result.detail}</span>}
        </p>
      )}
    </div>
  );
}
