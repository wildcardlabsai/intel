"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  disconnectPlanningAuthority,
  savePlanningConfig,
  testPlanningConnector,
  type PlanningAdminResult,
} from "@/app/admin/planning/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
  Textarea,
} from "@/components/ui/primitives";

/**
 * Connects a planning authority.
 *
 * "Test now" runs the connector against ten records only, so an administrator
 * can see whether a new field map actually reads this authority's data before
 * the nightly job runs against the whole feed.
 */
export function PlanningAuthorityForm({
  slug,
  adapter: initialAdapter,
  config: initialConfig,
  supportedAdapters,
  unsupportedAdapters,
}: {
  slug: string;
  adapter: string;
  config: string;
  supportedAdapters: string[];
  unsupportedAdapters: Array<{ key: string; reason: string }>;
}) {
  const router = useRouter();
  const [adapter, setAdapter] = useState(initialAdapter);
  const [config, setConfig] = useState(initialConfig);
  const [result, setResult] = useState<PlanningAdminResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const unsupportedReason = unsupportedAdapters.find((entry) => entry.key === adapter)?.reason;

  function run(action: () => Promise<PlanningAdminResult>) {
    startTransition(async () => {
      setResult(await action());
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection</CardTitle>
        <p className="mt-1 text-sm text-muted">
          Choose how this authority publishes its data, then map its field names onto ours.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-sm">
          <Label htmlFor="adapter">Adapter</Label>
          <Select
            id="adapter"
            value={adapter}
            onChange={(event) => setAdapter(event.target.value)}
          >
            <option value="">Not configured</option>
            <optgroup label="Machine-readable formats">
              {supportedAdapters.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </optgroup>
            <optgroup label="Recorded, but not readable">
              {unsupportedAdapters.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.key}
                </option>
              ))}
            </optgroup>
          </Select>
        </div>

        {unsupportedReason && (
          <p className="max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
            {unsupportedReason}
          </p>
        )}

        {!unsupportedReason && adapter && (
          <div>
            <Label htmlFor="config">Configuration (JSON)</Label>
            <Textarea
              id="config"
              rows={18}
              value={config}
              onChange={(event) => setConfig(event.target.value)}
              className="font-mono text-xs"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isPending}
            onClick={() => {
              const formData = new FormData();
              formData.set("slug", slug);
              formData.set("adapter", adapter);
              formData.set("config", config);
              run(() => savePlanningConfig(formData));
            }}
          >
            {isPending ? "Working…" : "Save configuration"}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isPending || !adapter || Boolean(unsupportedReason)}
            onClick={() => run(() => testPlanningConnector(slug))}
          >
            Test now (10 records)
          </Button>

          {initialAdapter && (
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => run(() => disconnectPlanningAuthority(slug))}
            >
              Disconnect
            </Button>
          )}
        </div>

        {result && (
          <div className={result.ok ? "text-sm text-accent-green" : "text-sm text-red-700"}>
            <p>{result.ok ? result.message : result.error}</p>
            {result.counters && (
              <p className="mt-1 text-xs text-muted">
                Fetched {result.counters.fetched}, created {result.counters.created}, updated{" "}
                {result.counters.updated}, rejected {result.counters.rejected}.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
