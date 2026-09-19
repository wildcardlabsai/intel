"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, Input, Label, Select } from "@/components/ui/primitives";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "DISSOLVED", label: "Dissolved" },
  { value: "LIQUIDATION", label: "Liquidation" },
  { value: "ADMINISTRATION", label: "Administration" },
];

const SORT_OPTIONS = [
  { value: "relevance", label: "Most relevant" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
];

export function CompanyFiltersPanel({
  localAuthorities,
  regions,
  current,
}: {
  localAuthorities: Array<{ name: string; slug: string }>;
  regions: Array<{ value: string; label: string }>;
  current: {
    q: string;
    region: string;
    localAuthority: string;
    status: string[];
    postcode: string;
    sort: string;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(current.q);
  const [postcode, setPostcode] = useState(current.postcode);

  function apply(updates: Record<string, string | string[] | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      next.delete(key);
      if (value === null || value === "") continue;
      if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
      else next.set(key, value);
    }
    next.delete("page");
    router.push(`?${next.toString()}`);
  }

  const hasFilters =
    current.q || current.region || current.localAuthority || current.status.length > 0 || current.postcode;

  return (
    <Card className="h-fit lg:sticky lg:top-20">
      <CardContent className="space-y-5 p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            apply({ q, postcode });
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="filter-q">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                id="filter-q"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Company name or number"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="filter-postcode">Postcode</Label>
            <Input
              id="filter-postcode"
              value={postcode}
              onChange={(event) => setPostcode(event.target.value)}
              placeholder="CF10 or CF10 1EP"
            />
          </div>

          <Button type="submit" className="w-full" size="sm">
            Apply
          </Button>
        </form>

        <div>
          <Label htmlFor="filter-region">Region</Label>
          <Select
            id="filter-region"
            value={current.region}
            onChange={(event) => apply({ region: event.target.value || null })}
          >
            <option value="">All of Wales</option>
            {regions.map((region) => (
              <option key={region.value} value={region.value}>
                {region.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="filter-authority">Local authority</Label>
          <Select
            id="filter-authority"
            value={current.localAuthority}
            onChange={(event) => apply({ localAuthority: event.target.value || null })}
          >
            <option value="">All authorities</option>
            {localAuthorities.map((authority) => (
              <option key={authority.slug} value={authority.slug}>
                {authority.name}
              </option>
            ))}
          </Select>
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-900">
            Company status
          </legend>
          <div className="space-y-1.5">
            {STATUS_OPTIONS.map((option) => {
              const checked = current.status.includes(option.value);
              return (
                <label key={option.value} className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? current.status.filter((value) => value !== option.value)
                        : [...current.status, option.value];
                      apply({ status: next });
                    }}
                    className="rounded border-border"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="filter-sort">Sort by</Label>
          <Select
            id="filter-sort"
            value={current.sort}
            onChange={(event) => apply({ sort: event.target.value })}
          >
            {SORT_OPTIONS.map((option) => (
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
            size="sm"
            className="w-full"
            onClick={() => {
              setQ("");
              setPostcode("");
              router.push("?");
            }}
          >
            <X className="h-4 w-4" />
            Clear filters
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
