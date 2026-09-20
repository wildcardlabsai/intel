"use client";

import { useState, useTransition } from "react";
import { Pause, Play, RefreshCw, Trash2 } from "lucide-react";

import {
  createAlert,
  deleteAlert,
  runAlertNow,
  toggleAlert,
  type AlertActionResult,
} from "@/app/dashboard/alerts/actions";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
} from "@/components/ui/primitives";
import { formatRelative, humanise } from "@/lib/utils";

type AlertRow = {
  id: string;
  name: string;
  entityType: string;
  query: string | null;
  frequency: string;
  isActive: boolean;
  emailEnabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  eventCount: number;
};

export function CreateAlertForm({
  localAuthorities,
  atLimit,
  limit,
  planName,
}: {
  localAuthorities: Array<{ name: string; slug: string }>;
  atLimit: boolean;
  limit: number;
  planName: string;
}) {
  const [result, setResult] = useState<AlertActionResult | null>(null);
  const [entityType, setEntityType] = useState("PROCUREMENT");
  const [isPending, startTransition] = useTransition();

  if (atLimit) {
    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Alert limit reached</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted">
          <p>
            Your {planName} plan includes {limit} active {limit === 1 ? "alert" : "alerts"}. Pause or
            delete one to create another, or upgrade for more.
          </p>
          <Button asChild variant="outline" size="sm">
            <a href="/dashboard/billing">View plans</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle>Create an alert</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={(formData) =>
            startTransition(async () => {
              const outcome = await createAlert(formData);
              setResult(outcome);
            })
          }
          className="space-y-4"
        >
          <div>
            <Label htmlFor="alert-name">Alert name</Label>
            <Input id="alert-name" name="name" required placeholder="Large construction contracts" />
          </div>

          <div>
            <Label htmlFor="alert-entity">Watch for</Label>
            <Select
              id="alert-entity"
              name="entityType"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
            >
              <option value="PROCUREMENT">Public contracts</option>
              <option value="COMPANY">New companies</option>
              <option value="PLANNING">Planning applications</option>
              <option value="FUNDING">Funding opportunities</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="alert-query">Keyword</Label>
            <Input id="alert-query" name="query" placeholder="construction, renewable energy…" />
          </div>

          <div>
            <Label htmlFor="alert-authority">Local authority</Label>
            <Select id="alert-authority" name="localAuthority" defaultValue="">
              <option value="">Anywhere in Wales</option>
              {localAuthorities.map((authority) => (
                <option key={authority.slug} value={authority.slug}>
                  {authority.name}
                </option>
              ))}
            </Select>
          </div>

          {entityType === "PROCUREMENT" && (
            <div>
              <Label htmlFor="alert-min-value">Minimum contract value</Label>
              <Select id="alert-min-value" name="minValue" defaultValue="">
                <option value="">Any value</option>
                <option value="25000">£25,000+</option>
                <option value="100000">£100,000+</option>
                <option value="500000">£500,000+</option>
                <option value="1000000">£1m+</option>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="alert-frequency">Check</Label>
            <Select id="alert-frequency" name="frequency" defaultValue="DAILY">
              <option value="IMMEDIATE">Hourly</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="emailEnabled" defaultChecked className="rounded border-border" />
            Email me when there are matches
          </label>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating…" : "Create alert"}
          </Button>

          {result?.error && <p className="text-sm text-red-700">{result.error}</p>}
          {result?.ok && result.message && (
            <p className="text-sm text-emerald-800">{result.message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export function AlertList({ alerts }: { alerts: AlertRow[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<AlertActionResult>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.error ?? result.message ?? null);
    });
  }

  return (
    <div className="space-y-3">
      {message && <p className="text-sm text-muted">{message}</p>}

      {alerts.map((alert) => (
        <Card key={alert.id}>
          <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-ink-900">{alert.name}</h3>
                <Badge tone={alert.isActive ? "positive" : "neutral"}>
                  {alert.isActive ? "Active" : "Paused"}
                </Badge>
                <Badge tone="neutral">{humanise(alert.entityType)}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {alert.query ? `“${alert.query}” · ` : ""}
                {humanise(alert.frequency)}
                {alert.emailEnabled ? " · email on" : " · in-app only"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {alert.eventCount} {alert.eventCount === 1 ? "match" : "matches"} ·{" "}
                {alert.lastRunAt ? `last run ${formatRelative(alert.lastRunAt)}` : "not run yet"}
                {alert.nextRunAt ? ` · next ${formatRelative(alert.nextRunAt)}` : ""}
              </p>
            </div>

            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => run(() => runAlertNow(alert.id))}
                title="Run now"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => run(() => toggleAlert(alert.id))}
                title={alert.isActive ? "Pause" : "Resume"}
              >
                {alert.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => run(() => deleteAlert(alert.id))}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
