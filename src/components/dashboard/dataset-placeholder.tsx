import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { prisma } from "@/lib/db/prisma";
import { formatNumber, formatRelative, humanise } from "@/lib/utils";

/**
 * Shown on a dataset page whose source has not been connected.
 *
 * It reports the registry's real status and message rather than an empty table
 * that could be mistaken for "there is nothing happening in Wales".
 */
export async function DatasetStatus({
  sourceKey,
  what,
}: {
  sourceKey: string;
  what: string;
}) {
  const source = await prisma.dataSource.findUnique({ where: { key: sourceKey } });

  if (!source) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Source not registered</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          <p>
            No data source is registered under the key <code className="font-mono">{sourceKey}</code>.
            Run <code className="font-mono">npm run db:seed:reference</code> to create the source
            registry.
          </p>
        </CardContent>
      </Card>
    );
  }

  const tone =
    source.status === "CONNECTED"
      ? "positive"
      : source.status === "ERROR"
        ? "critical"
        : source.status === "NOT_CONFIGURED"
          ? "warning"
          : "neutral";

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{source.name}</CardTitle>
          <p className="mt-1 text-sm text-muted">{source.organisation}</p>
        </div>
        <Badge tone={tone}>{humanise(source.status)}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed text-muted">
        {source.description && <p>{source.description}</p>}
        {source.statusMessage && (
          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">{source.statusMessage}</p>
        )}
        <div className="grid grid-cols-2 gap-3 pt-2 text-xs sm:grid-cols-4">
          <Field label="Records" value={formatNumber(source.totalRecords)} />
          <Field label="Last sync" value={formatRelative(source.lastSuccessAt)} />
          <Field label="Publisher cadence" value={source.updateFrequency ?? "Not published"} />
          <Field label="Licence" value={source.licence ?? "Not stated"} />
        </div>
        <p className="pt-1 text-xs">
          No {what} are shown while this source is unconnected. Figures on this platform are never
          estimated or filled in.
        </p>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 text-ink-900">{value}</p>
    </div>
  );
}
