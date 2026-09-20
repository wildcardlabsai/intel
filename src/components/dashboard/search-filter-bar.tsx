"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, Input, Label, Select } from "@/components/ui/primitives";

/**
 * Horizontal filter bar shared by the procurement, planning, funding and jobs
 * searches. Company search keeps its own sidebar because it has far more
 * facets than fit in a bar.
 */

export type FilterSelect = {
  name: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
};

export function SearchFilterBar({
  basePath,
  searchPlaceholder,
  current,
  selects,
  sortOptions,
}: {
  basePath: string;
  searchPlaceholder: string;
  current: { q: string; sort: string };
  selects: FilterSelect[];
  sortOptions: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(current.q);

  function apply(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    router.push(`${basePath}?${next.toString()}`);
  }

  const hasFilters =
    current.q.length > 0 || selects.some((select) => select.value.length > 0);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              apply({ q });
            }}
            className="flex min-w-[240px] flex-1 items-end gap-2"
          >
            <div className="flex-1">
              <Label htmlFor="filter-q">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  id="filter-q"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-9"
                />
              </div>
            </div>
            <Button type="submit" size="md">
              Search
            </Button>
          </form>

          {selects.map((select) => (
            <div key={select.name} className="min-w-[160px]">
              <Label htmlFor={`filter-${select.name}`}>{select.label}</Label>
              <Select
                id={`filter-${select.name}`}
                value={select.value}
                onChange={(event) => apply({ [select.name]: event.target.value || null })}
              >
                {select.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          ))}

          <div className="min-w-[160px]">
            <Label htmlFor="filter-sort">Sort by</Label>
            <Select
              id="filter-sort"
              value={current.sort}
              onChange={(event) => apply({ sort: event.target.value })}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => {
                setQ("");
                router.push(basePath);
              }}
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
