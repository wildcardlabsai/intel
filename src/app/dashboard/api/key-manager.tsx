"use client";

import { useState, useTransition } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";

import { createApiKey, revokeApiKey } from "@/app/dashboard/api/actions";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { formatDate, formatRelative } from "@/lib/utils";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  rateLimitPerMinute: number;
};

export function ApiKeyManager({ keys }: { keys: KeyRow[] }) {
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>API keys</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {newKey && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">
              Copy this key now — it will not be shown again.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded bg-white px-3 py-2 font-mono text-xs text-ink-900">
                {newKey}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(newKey);
                    setCopied(true);
                  } catch {
                    // Clipboard access can be blocked; the key is visible to
                    // select manually, so this needs no error state.
                  }
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}

        <form
          action={(formData) =>
            startTransition(async () => {
              setError(null);
              setNewKey(null);
              setCopied(false);
              const result = await createApiKey(formData);
              if (result.ok) setNewKey(result.plaintext);
              else setError(result.error);
            })
          }
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="key-name">Key name</Label>
            <Input id="key-name" name="name" placeholder="Production integration" required />
          </div>
          <Button type="submit" disabled={isPending}>
            <KeyRound className="h-4 w-4" />
            {isPending ? "Creating…" : "Create key"}
          </Button>
        </form>

        {error && <p className="text-sm text-red-700">{error}</p>}

        {keys.length === 0 ? (
          <p className="text-sm text-muted">No API keys yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Key</Th>
                <Th className="hidden sm:table-cell">Created</Th>
                <Th className="hidden sm:table-cell">Last used</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <Td>
                    <span className="font-medium text-ink-900">{key.name}</span>
                    {key.revokedAt && (
                      <Badge tone="neutral" className="ml-2">
                        Revoked
                      </Badge>
                    )}
                    <p className="text-xs text-muted">{key.rateLimitPerMinute} req/min</p>
                  </Td>
                  <Td>
                    <code className="font-mono text-xs text-muted">{key.prefix}…</code>
                  </Td>
                  <Td className="hidden sm:table-cell text-muted">{formatDate(key.createdAt)}</Td>
                  <Td className="hidden sm:table-cell text-muted">
                    {key.lastUsedAt ? formatRelative(key.lastUsedAt) : "Never"}
                  </Td>
                  <Td className="text-right">
                    {!key.revokedAt && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await revokeApiKey(key.id);
                            if (!result.ok) setError(result.error ?? "Could not revoke that key.");
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Revoke
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
