"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CornerDownLeft, Info, Sparkle } from "lucide-react";

import { askCompanySearch, type AskResult } from "@/app/dashboard/companies/ask-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Input } from "@/components/ui/primitives";

/**
 * Plain-English search.
 *
 * The phrase is turned into ordinary filters server-side and the user is
 * navigated to a normal search URL, so the result is shareable, bookmarkable
 * and saveable like any other search. What was actually applied is always
 * shown before navigating; nothing is applied silently.
 */
export function AskBox({ examples }: { examples: string[] }) {
  const router = useRouter();
  const [phrase, setPhrase] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(value: string) {
    const formData = new FormData();
    formData.set("phrase", value);
    startTransition(async () => {
      setResult(null);
      setResult(await askCompanySearch(formData));
    });
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit(phrase);
          }}
        >
          <div className="min-w-[240px] flex-1">
            <label
              htmlFor="ask"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-900"
            >
              Describe what you are looking for
            </label>
            <div className="relative">
              <Sparkle
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                strokeWidth={1.5}
              />
              <Input
                id="ask"
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                placeholder="Active construction firms in Gwynedd registered since 2020"
                className="pl-9"
              />
            </div>
          </div>
          <Button type="submit" disabled={isPending || phrase.trim().length < 3}>
            {isPending ? "Reading…" : "Build the search"}
            {!isPending && <CornerDownLeft className="h-4 w-4" />}
          </Button>
        </form>

        {!result && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Try:</span>
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                className="rounded-full border border-border bg-cream px-2.5 py-1 text-[11px] text-muted transition-colors hover:text-ink-900"
                onClick={() => {
                  setPhrase(example);
                  submit(example);
                }}
              >
                {example}
              </button>
            ))}
          </div>
        )}

        {result && (
          <div className="mt-3 border-t border-border/60 pt-3">
            <AskOutcome result={result} onRun={(href) => router.push(href)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AskOutcome({
  result,
  onRun,
}: {
  result: AskResult;
  onRun: (href: string) => void;
}) {
  if (result.status === "not_configured") {
    return (
      <div className="text-sm">
        <p className="font-semibold text-ink-900">Plain-English search is not configured</p>
        <p className="mt-1 text-muted">
          Set{" "}
          {result.missingEnvVars.map((name, index) => (
            <span key={name}>
              {index > 0 && ", "}
              <code className="rounded bg-cream px-1 py-0.5 font-mono text-xs text-ink-900">
                {name}
              </code>
            </span>
          ))}{" "}
          to enable it. The filter panel below works without it.
        </p>
      </div>
    );
  }

  if (result.status === "error") {
    return <p className="text-sm text-red-700">{result.message}</p>;
  }

  if (result.status === "no_filters") {
    return (
      <div className="text-sm">
        <p className="text-muted">
          Nothing in that mapped to a filter, so it will be searched as plain text.
        </p>
        <Button className="mt-2" size="sm" onClick={() => onRun(result.href)}>
          Search for “{result.phrase}”
        </Button>
      </div>
    );
  }

  return (
    <div className="text-sm">
      <p className="text-muted">
        Read as: <span className="font-semibold text-ink-900">{result.description}</span>
      </p>

      {result.dropped.length > 0 && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Ignored, because {result.dropped.length === 1 ? "it is" : "they are"} not a value this
          dataset holds: {result.dropped.join(", ")}.
        </p>
      )}

      {result.unresolved.length > 0 && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Not filtered on, because this dataset does not hold it:{" "}
          {result.unresolved.join("; ")}.
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onRun(result.href)}>
          Run this search
        </Button>
        <span className="self-center text-xs text-muted">
          You can adjust every filter afterwards.
        </span>
      </div>
    </div>
  );
}
