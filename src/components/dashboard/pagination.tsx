import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Pagination that preserves every other query parameter, so paging never
 * silently drops the user's filters.
 */
export function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string | string[] | undefined>;
}) {
  if (totalPages <= 1) return null;

  const buildHref = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page" || value === undefined) continue;
      if (Array.isArray(value)) value.forEach((entry) => next.append(key, entry));
      else next.set(key, value);
    }
    next.set("page", String(target));
    return `?${next.toString()}`;
  };

  const previousDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav className="flex items-center justify-between" aria-label="Pagination">
      {previousDisabled ? (
        <Button variant="outline" size="sm" disabled>
          Previous
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href={buildHref(page - 1)} rel="prev">
            Previous
          </Link>
        </Button>
      )}

      <span className="text-sm text-muted">
        Page {page} of {totalPages}
      </span>

      {nextDisabled ? (
        <Button variant="outline" size="sm" disabled>
          Next
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href={buildHref(page + 1)} rel="next">
            Next
          </Link>
        </Button>
      )}
    </nav>
  );
}
