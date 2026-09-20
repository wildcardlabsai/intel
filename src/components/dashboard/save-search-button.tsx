"use client";

import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { BookmarkPlus, Check } from "lucide-react";

import { saveSearch } from "@/app/dashboard/saved/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import type { SaveableEntityType } from "@/lib/search/saved-search";

/**
 * "Save this search" control shown on every search page.
 *
 * It posts the current query string rather than a reconstructed filter object,
 * so there is exactly one place — `captureSearch` on the server — that decides
 * what a saved search contains. The button knows nothing about filters.
 */
export function SaveSearchButton({
  entityType,
  /** Suggested name, usually the current query term. */
  defaultName,
}: {
  entityType: SaveableEntityType;
  defaultName?: string;
}) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const params = searchParams.toString();
  const hasSomethingToSave = params.replace(/(^|&)(page|perPage)=[^&]*/g, "").replace(/^&/, "").length > 0;

  if (saved) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-green">
        <Check className="h-4 w-4" />
        Saved
      </span>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasSomethingToSave}
        title={
          hasSomethingToSave
            ? "Save these filters so you can re-run them later"
            : "Add a search term or a filter first"
        }
        onClick={() => setOpen(true)}
      >
        <BookmarkPlus className="h-4 w-4" />
        Save this search
      </Button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set("name", name);
        formData.set("entityType", entityType);
        formData.set("params", params);

        startTransition(async () => {
          setError(null);
          const result = await saveSearch(formData);
          if (result.ok) setSaved(true);
          else setError(result.error ?? "Could not save that search.");
        });
      }}
    >
      <div>
        <Input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name this search"
          aria-label="Name this search"
          className="w-56 py-1.5 text-sm"
        />
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}
