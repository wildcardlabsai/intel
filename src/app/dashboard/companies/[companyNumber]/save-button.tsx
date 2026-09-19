"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";

import { toggleSavedCompany } from "@/app/dashboard/companies/actions";
import { Button } from "@/components/ui/button";

export function SaveCompanyButton({
  companyId,
  initiallySaved,
}: {
  companyId: string;
  initiallySaved: boolean;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={saved ? "primary" : "outline"}
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await toggleSavedCompany(companyId);
            if (result.error) {
              setError(result.error);
              return;
            }
            setSaved(result.saved);
          })
        }
      >
        {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
        {saved ? "Saved" : "Save company"}
      </Button>
      {error && <p className="max-w-xs text-right text-xs text-red-700">{error}</p>}
    </div>
  );
}
