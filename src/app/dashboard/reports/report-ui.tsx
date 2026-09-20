"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { generateReport } from "@/app/dashboard/reports/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Label, Select } from "@/components/ui/primitives";

export function GenerateReportForm({
  localAuthorities,
}: {
  localAuthorities: Array<{ name: string; slug: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="h-fit lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle>Generate a report</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={(formData) =>
            startTransition(async () => {
              setError(null);
              const result = await generateReport(formData);
              if (result.ok && result.reportId) router.push(`/dashboard/reports/${result.reportId}`);
              else setError(result.error ?? "Could not generate that report.");
            })
          }
          className="space-y-4"
        >
          <div>
            <Label htmlFor="report-type">Report type</Label>
            <Select id="report-type" name="type" defaultValue="REGIONAL">
              <option value="REGIONAL">Regional business activity</option>
              <option value="SECTOR">Sector breakdown</option>
              <option value="PROCUREMENT">Public procurement</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="report-authority">Area</Label>
            <Select id="report-authority" name="localAuthority" defaultValue="">
              <option value="">All of Wales</option>
              {localAuthorities.map((authority) => (
                <option key={authority.slug} value={authority.slug}>
                  {authority.name}
                </option>
              ))}
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Generating…" : "Generate report"}
          </Button>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <p className="text-xs leading-relaxed text-muted">
            Reports are built from live counts at the moment of generation, with the sources and
            data date recorded alongside them.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
