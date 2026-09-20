"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bell, Pencil, Play, Trash2 } from "lucide-react";

import {
  createAlertFromSavedSearch,
  deleteSavedSearch,
  renameSavedSearch,
} from "@/app/dashboard/saved/actions";
import { Button } from "@/components/ui/button";
import { Badge, Input } from "@/components/ui/primitives";
import {
  ENTITY_LABELS,
  savedSearchHref,
  type SaveableEntityType,
} from "@/lib/search/saved-search";

export type SavedSearchItem = {
  id: string;
  name: string;
  entityType: SaveableEntityType;
  query: string | null;
  filters: Record<string, unknown>;
  description: string;
  updatedAt: string;
};

export function SavedSearchList({ items }: { items: SavedSearchItem[] }) {
  const [rows, setRows] = useState(items);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleResult(result: { ok: boolean; message?: string; error?: string }) {
    setMessage(result.ok ? (result.message ?? null) : null);
    setError(result.ok ? null : (result.error ?? "Something went wrong."));
  }

  return (
    <div className="space-y-3">
      {(message || error) && (
        <p className={error ? "text-sm text-red-700" : "text-sm text-accent-green"}>
          {error ?? message}
        </p>
      )}

      <ul className="divide-y divide-border/60">
        {rows.map((row) => (
          <SavedSearchRow
            key={row.id}
            row={row}
            onRemoved={() => setRows((current) => current.filter((r) => r.id !== row.id))}
            onRenamed={(name) =>
              setRows((current) => current.map((r) => (r.id === row.id ? { ...r, name } : r)))
            }
            onResult={handleResult}
          />
        ))}
      </ul>
    </div>
  );
}

function SavedSearchRow({
  row,
  onRemoved,
  onRenamed,
  onResult,
}: {
  row: SavedSearchItem;
  onRemoved: () => void;
  onRenamed: (name: string) => void;
  onResult: (result: { ok: boolean; message?: string; error?: string }) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(row.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const href = savedSearchHref(row.entityType, row.query, row.filters);

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        {renaming ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await renameSavedSearch(row.id, name);
                onResult(result);
                if (result.ok) {
                  onRenamed(name);
                  setRenaming(false);
                }
              });
            }}
          >
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Search name"
              className="w-56 py-1.5 text-sm"
            />
            <Button type="submit" size="sm" disabled={isPending}>
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setName(row.name);
                setRenaming(false);
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Link href={href} className="font-semibold text-ink-900 hover:text-accent-green">
              {row.name}
            </Link>
            <Badge tone="neutral">{ENTITY_LABELS[row.entityType]}</Badge>
          </div>
        )}
        <p className="mt-1 truncate text-xs text-muted">{row.description}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button asChild variant="ghost" size="sm" title="Run this search">
          <Link href={href}>
            <Play className="h-4 w-4" />
            Run
          </Link>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Create a daily alert from this search"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              onResult(await createAlertFromSavedSearch(row.id));
            })
          }
        >
          <Bell className="h-4 w-4" />
          <span className="sr-only">Create alert</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Rename"
          onClick={() => setRenaming(true)}
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Rename</span>
        </Button>

        {confirmingDelete ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteSavedSearch(row.id);
                  onResult(result);
                  if (result.ok) onRemoved();
                })
              }
            >
              Confirm
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="Delete"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        )}
      </div>
    </li>
  );
}
