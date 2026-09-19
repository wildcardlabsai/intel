import { ExternalLink, Info } from "lucide-react";

import { Badge } from "@/components/ui/primitives";
import { cn, formatDate, formatRelative } from "@/lib/utils";

/**
 * Source attribution.
 *
 * Every externally sourced figure or record on this platform is rendered with
 * this component, so a user can always see who published it, when we last
 * checked, and follow the link back to the original. It is deliberately
 * unavoidable rather than optional.
 */

const SOURCE_LABELS: Record<string, { name: string; organisation: string; homepage: string }> = {
  companies_house: {
    name: "Companies House",
    organisation: "Companies House (UK Government)",
    homepage: "https://find-and-update.company-information.service.gov.uk/",
  },
  sell2wales: {
    name: "Sell2Wales",
    organisation: "Welsh Government",
    homepage: "https://www.sell2wales.gov.wales/",
  },
  postcodes_io: {
    name: "postcodes.io",
    organisation: "ONS / Ordnance Survey derived",
    homepage: "https://postcodes.io/",
  },
  datamapwales: {
    name: "DataMapWales",
    organisation: "Welsh Government",
    homepage: "https://datamap.gov.wales/",
  },
};

export function sourceLabel(source: string): { name: string; organisation: string; homepage: string } {
  return (
    SOURCE_LABELS[source] ?? {
      name: source.replace(/_/g, " "),
      organisation: source.replace(/_/g, " "),
      homepage: "",
    }
  );
}

export function SourceBadge({
  source,
  sourceUrl,
  lastUpdatedAt,
  lastSeenAt,
  className,
}: {
  source: string;
  sourceUrl?: string | null;
  lastUpdatedAt?: Date | string | null;
  lastSeenAt?: Date | string | null;
  className?: string;
}) {
  const label = sourceLabel(source);

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted", className)}>
      <Badge tone="neutral">
        Source: {label.name}
      </Badge>
      {lastUpdatedAt && <span>Updated {formatDate(lastUpdatedAt)}</span>}
      {lastSeenAt && <span>Checked {formatRelative(lastSeenAt)}</span>}
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-accent-green hover:underline"
        >
          View at source
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

/**
 * Block shown at the foot of any page built from public data. Names every
 * source used and states clearly that Cymru Intelligence is independent.
 */
export function SourceFooter({
  sources,
  dataAsOf,
}: {
  sources: string[];
  dataAsOf?: Date | string | null;
}) {
  const unique = [...new Set(sources)];
  if (unique.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-cream/60 p-5 text-xs leading-relaxed text-muted">
      <div className="mb-2 flex items-center gap-2 font-semibold text-ink-900">
        <Info className="h-4 w-4" />
        Where this comes from
      </div>
      <ul className="space-y-1">
        {unique.map((source) => {
          const label = sourceLabel(source);
          return (
            <li key={source}>
              <span className="font-medium text-ink-900">{label.name}</span> — published by{" "}
              {label.organisation}
              {label.homepage && (
                <>
                  {" "}
                  (
                  <a
                    href={label.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-green hover:underline"
                  >
                    website
                  </a>
                  )
                </>
              )}
            </li>
          );
        })}
      </ul>
      {dataAsOf && <p className="mt-2">Figures on this page reflect data held as of {formatDate(dataAsOf)}.</p>}
      <p className="mt-2">
        Cymru Intelligence is an independent service. Using public data published by a government
        body does not imply any affiliation with or endorsement by that body.
      </p>
    </div>
  );
}

/**
 * Rendered wherever a feature depends on an integration that has no
 * credentials. States the missing variable plainly — never a fabricated
 * placeholder dataset.
 */
export function NotConfigured({
  title,
  integration,
  missingEnvVars,
  impact,
  docsUrl,
}: {
  title: string;
  integration: string;
  missingEnvVars: string[];
  impact: string;
  docsUrl?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-6">
      <Badge tone="warning">Not configured</Badge>
      <h3 className="mt-3 text-base font-bold text-ink-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{impact}</p>
      {missingEnvVars.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-900">
            Missing environment {missingEnvVars.length === 1 ? "variable" : "variables"}
          </p>
          <ul className="mt-2 space-y-1">
            {missingEnvVars.map((name) => (
              <li key={name}>
                <code className="rounded bg-white px-2 py-1 font-mono text-xs text-ink-900">{name}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 text-xs text-muted">
        Set {missingEnvVars.length === 1 ? "this variable" : "these variables"} and redeploy to enable{" "}
        {integration}.{" "}
        {docsUrl && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-accent-green hover:underline"
          >
            Setup guide
          </a>
        )}
      </p>
    </div>
  );
}

/**
 * Shown when a query ran correctly but the database has nothing yet, because
 * ingestion has not run. Distinct from "no results match your filters".
 */
export function AwaitingSync({ what, sourceName }: { what: string; sourceName: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
      <Badge tone="info">Awaiting first sync</Badge>
      <h3 className="mt-3 text-base font-bold text-ink-900">No {what} ingested yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {sourceName} is connected but has not completed an initial import. Data will appear here
        once the first sync finishes. Nothing is shown in the meantime — these figures are never
        estimated or filled in.
      </p>
    </div>
  );
}
