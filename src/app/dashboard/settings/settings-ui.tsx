"use client";

import { useState, useTransition } from "react";
import { Download, TriangleAlert } from "lucide-react";

import {
  deleteMyAccount,
  exportMyData,
  updateProfile,
  type SettingsResult,
} from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui/primitives";

export function AccountSettingsForm({
  initial,
}: {
  initial: {
    name: string;
    jobTitle: string;
    emailAlerts: boolean;
    emailDigest: boolean;
    emailProduct: boolean;
  };
}) {
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile and notifications</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={(formData) =>
            startTransition(async () => setResult(await updateProfile(formData)))
          }
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="settings-name">Name</Label>
              <Input id="settings-name" name="name" defaultValue={initial.name} />
            </div>
            <div>
              <Label htmlFor="settings-job">Job title</Label>
              <Input id="settings-job" name="jobTitle" defaultValue={initial.jobTitle} />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-900">
              Email me about
            </legend>
            <Checkbox name="emailAlerts" defaultChecked={initial.emailAlerts} label="Alert matches" />
            <Checkbox
              name="emailDigest"
              defaultChecked={initial.emailDigest}
              label="Weekly intelligence digest"
            />
            <Checkbox
              name="emailProduct"
              defaultChecked={initial.emailProduct}
              label="Product updates"
            />
          </fieldset>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save settings"}
          </Button>

          {result?.message && <p className="text-sm text-emerald-800">{result.message}</p>}
          {result?.error && <p className="text-sm text-red-700">{result.error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

function Checkbox({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="rounded border-border" />
      {label}
    </label>
  );
}

export function DataExport() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed text-muted">
          Download everything held about your account: profile, saved companies, alerts, saved
          searches, reports, API key metadata, usage history and consent records.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await exportMyData();
              if (!result.ok) {
                setError(result.error);
                return;
              }
              const blob = new Blob([result.json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = `cymru-intelligence-my-data-${new Date()
                .toISOString()
                .slice(0, 10)}.json`;
              anchor.click();
              URL.revokeObjectURL(url);
            })
          }
        >
          <Download className="h-4 w-4" />
          {isPending ? "Preparing…" : "Download my data"}
        </Button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </CardContent>
    </Card>
  );
}

export function DangerZone() {
  const [confirmation, setConfirmation] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-900">
          <TriangleAlert className="h-4 w-4" />
          Delete account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed text-muted">
          Deleting your account removes your profile, saved companies, alerts and saved searches,
          revokes your API keys, and deletes your sign-in credentials. This cannot be undone.
        </p>
        <p className="text-xs leading-relaxed text-muted">
          Public records about companies are not affected — they are public sector information, not
          personal data belonging to your account.
        </p>

        {!open ? (
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            Delete my account
          </Button>
        ) : result?.ok ? (
          <p className="text-sm text-emerald-800">{result.message}</p>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="confirm-delete">Type DELETE to confirm</Label>
              <Input
                id="confirm-delete"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="DELETE"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="danger"
                disabled={isPending || confirmation.trim().toUpperCase() !== "DELETE"}
                onClick={() =>
                  startTransition(async () => {
                    // On success the action redirects, so anything returned
                    // here is a failure.
                    const outcome = await deleteMyAccount(confirmation);
                    setResult(outcome);
                  })
                }
              >
                {isPending ? "Deleting…" : "Permanently delete"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
            {result?.error && <p className="text-sm text-red-700">{result.error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
