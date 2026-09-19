import "server-only";

import { createHash } from "node:crypto";

import type { ImportTrigger } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import type {
  Connector,
  ConnectorContext,
  RecordFailure,
  RunCounters,
  RunResult,
} from "@/lib/ingestion/types";

/**
 * Drives a connector through the ingestion pipeline.
 *
 * Guarantees:
 *  - A malformed record never aborts the run. It is recorded in
 *    data_import_errors, counted as rejected, and the run continues.
 *  - Every stored row keeps its provenance (source, source id, source url,
 *    first/last seen) and points at the verbatim payload in raw_records.
 *  - Unchanged records are detected by content hash and skipped before any
 *    write, so a daily re-run of an unchanged feed costs almost nothing.
 *  - A failed run never deletes or truncates existing good data. Connectors
 *    only ever upsert.
 */

const DEFAULT_LIMIT = 5_000;

export type RunOptions = {
  trigger?: ImportTrigger;
  limit?: number;
  /** Overrides the stored cursor — used for backfills. */
  cursor?: string | null;
  triggeredByUserId?: string | null;
  signal?: AbortSignal;
};

export async function runConnector<TRaw, TNormalised>(
  connector: Connector<TRaw, TNormalised>,
  options: RunOptions = {}
): Promise<RunResult> {
  const startedAt = Date.now();
  const log = logger.child({ connector: connector.key });

  const dataSource = await prisma.dataSource.findUnique({
    where: { key: connector.dataSourceKey },
  });

  if (!dataSource) {
    throw new Error(
      `Data source "${connector.dataSourceKey}" is not registered. ` +
        `Run the reference data seed (npm run db:seed:reference) first.`
    );
  }

  if (!dataSource.enabled) {
    log.info("connector skipped: source disabled");
    return {
      runId: "",
      status: "FAILED",
      counters: emptyCounters(),
      cursor: null,
      durationMs: 0,
      errors: [],
      notConfiguredReason: "Source is disabled by an administrator.",
    };
  }

  // Refuse to run — and say exactly why — rather than producing empty results
  // that could be mistaken for "there is no data".
  const readiness = connector.readiness();
  if (!readiness.ready) {
    await prisma.dataSource.update({
      where: { id: dataSource.id },
      data: {
        status: "NOT_CONFIGURED",
        statusMessage: readiness.reason,
        lastCheckedAt: new Date(),
      },
    });
    log.warn("connector not configured", { reason: readiness.reason });
    return {
      runId: "",
      status: "FAILED",
      counters: emptyCounters(),
      cursor: null,
      durationMs: Date.now() - startedAt,
      errors: [],
      notConfiguredReason: readiness.reason,
    };
  }

  const cursorBefore =
    options.cursor !== undefined ? options.cursor : (dataSource.config as { cursor?: string })?.cursor ?? null;

  const run = await prisma.dataImportRun.create({
    data: {
      dataSourceId: dataSource.id,
      connectorKey: connector.key,
      status: "RUNNING",
      trigger: options.trigger ?? "CRON",
      cursorBefore,
      triggeredByUserId: options.triggeredByUserId ?? null,
    },
  });

  await prisma.dataSource.update({
    where: { id: dataSource.id },
    data: { lastRunAt: new Date(), lastCheckedAt: new Date() },
  });

  const counters = emptyCounters();
  const errors: RecordFailure[] = [];

  const context: ConnectorContext = {
    cursor: cursorBefore,
    limit: options.limit ?? DEFAULT_LIMIT,
    trigger: options.trigger ?? "CRON",
    runId: run.id,
    dataSourceId: dataSource.id,
    logger: log,
    signal: options.signal,
  };

  let cursorAfter: string | null = cursorBefore;
  let fatalError: unknown = null;

  try {
    const iterator = connector.fetch(context);

    for (;;) {
      const next = await iterator.next();
      if (next.done) {
        cursorAfter = next.value ?? cursorAfter;
        break;
      }

      const record = next.value;
      counters.fetched += 1;

      try {
        // --- VALIDATE ---------------------------------------------------
        const validation = connector.validate(record);
        if (!validation.ok) {
          counters.rejected += 1;
          errors.push({
            stage: "VALIDATE",
            sourceRecordId: record.sourceRecordId,
            message: validation.reason,
            payload: record.raw,
          });
          continue;
        }

        // --- DEDUPLICATE -------------------------------------------------
        // Hash the payload; an identical payload means nothing changed at the
        // publisher, so there is no work to do beyond touching last_seen_at.
        const contentHash = hashPayload(record.raw);
        const existingRaw = await prisma.rawRecord.findUnique({
          where: {
            dataSourceId_sourceRecordId_contentHash: {
              dataSourceId: dataSource.id,
              sourceRecordId: record.sourceRecordId,
              contentHash,
            },
          },
          select: { id: true },
        });

        if (existingRaw) {
          counters.skipped += 1;
          await prisma.rawRecord.update({
            where: { id: existingRaw.id },
            data: { fetchedAt: new Date() },
          });
          continue;
        }

        // --- STORE RAW ----------------------------------------------------
        const rawRecord = await prisma.rawRecord.create({
          data: {
            dataSourceId: dataSource.id,
            sourceRecordId: record.sourceRecordId,
            contentHash,
            payload: record.raw as never,
          },
          select: { id: true },
        });

        // --- NORMALISE ----------------------------------------------------
        let normalised: TNormalised;
        try {
          normalised = connector.normalise(validation.value);
        } catch (error) {
          counters.rejected += 1;
          errors.push({
            stage: "NORMALISE",
            sourceRecordId: record.sourceRecordId,
            message: error instanceof Error ? error.message : String(error),
            payload: record.raw,
          });
          continue;
        }

        // --- RESOLVE + STORE ----------------------------------------------
        // Entity resolution happens inside store(), where the connector knows
        // which fields identify an organisation.
        const outcome = await connector.store(normalised, { ...context, rawRecordId: rawRecord.id });
        if (outcome === "created") counters.created += 1;
        else if (outcome === "updated") counters.updated += 1;
        else counters.skipped += 1;
      } catch (error) {
        counters.rejected += 1;
        errors.push({
          stage: "STORE",
          sourceRecordId: record.sourceRecordId,
          message: error instanceof Error ? error.message : String(error),
          payload: record.raw,
        });
        log.warn("record failed", {
          sourceRecordId: record.sourceRecordId,
          message: error instanceof Error ? error.message : String(error),
        });
      }

      if (counters.fetched >= context.limit) {
        log.info("run limit reached", { limit: context.limit });
        break;
      }
    }

    if (connector.afterRun) {
      await connector.afterRun({ ...context, counters });
    }
  } catch (error) {
    fatalError = error;
    log.error("connector run failed", error);
  }

  // --- LOG -----------------------------------------------------------------
  const durationMs = Date.now() - startedAt;
  const status: RunResult["status"] = fatalError
    ? "FAILED"
    : counters.rejected > 0
      ? "PARTIAL"
      : "SUCCESS";

  // Persist per-record errors in bounded batches so a pathological run cannot
  // write hundreds of thousands of rows.
  const errorsToPersist = errors.slice(0, 500);
  if (errorsToPersist.length > 0) {
    await prisma.dataImportError.createMany({
      data: errorsToPersist.map((failure) => ({
        runId: run.id,
        stage: failure.stage,
        sourceRecordId: failure.sourceRecordId,
        message: failure.message.slice(0, 2_000),
        payload: (failure.payload ?? null) as never,
      })),
    });
  }

  await prisma.dataImportRun.update({
    where: { id: run.id },
    data: {
      status,
      finishedAt: new Date(),
      durationMs,
      recordsFetched: counters.fetched,
      recordsCreated: counters.created,
      recordsUpdated: counters.updated,
      recordsSkipped: counters.skipped,
      recordsRejected: counters.rejected,
      cursorAfter,
      error: fatalError instanceof Error ? fatalError.message.slice(0, 2_000) : null,
      stats: {
        errorSample: errorsToPersist.slice(0, 10).map((e) => ({ stage: e.stage, message: e.message })),
        truncatedErrors: Math.max(0, errors.length - errorsToPersist.length),
      },
    },
  });

  await prisma.dataSource.update({
    where: { id: dataSource.id },
    data: {
      status: fatalError ? "ERROR" : "CONNECTED",
      statusMessage: fatalError
        ? fatalError instanceof Error
          ? fatalError.message.slice(0, 500)
          : String(fatalError)
        : null,
      lastSuccessAt: fatalError ? dataSource.lastSuccessAt : new Date(),
      lastErrorAt: fatalError ? new Date() : dataSource.lastErrorAt,
      lastError: fatalError
        ? fatalError instanceof Error
          ? fatalError.message.slice(0, 2_000)
          : String(fatalError)
        : dataSource.lastError,
      totalRecords: { increment: counters.created },
      config: { ...(dataSource.config as object), cursor: cursorAfter },
    },
  });

  log.info("connector run finished", { status, durationMs, ...counters });

  return {
    runId: run.id,
    status,
    counters,
    cursor: cursorAfter,
    durationMs,
    errors,
  };
}

export function emptyCounters(): RunCounters {
  return { fetched: 0, created: 0, updated: 0, skipped: 0, rejected: 0 };
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

/**
 * Deterministic JSON stringify: key order must not change the hash, otherwise
 * every run would look like a change and we would rewrite unchanged rows.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/**
 * Records field-level changes so a profile can show "status changed from
 * active to liquidation" with the run that observed it.
 */
export async function recordChanges(params: {
  entityType: string;
  entityId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  fields: string[];
  dataSourceId: string;
  runId: string;
}): Promise<string[]> {
  const changed: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

  for (const field of params.fields) {
    const before = serialiseValue(params.before[field]);
    const after = serialiseValue(params.after[field]);
    if (before !== after) {
      changed.push({ field, oldValue: before, newValue: after });
    }
  }

  if (changed.length === 0) return [];

  await prisma.dataChangeLog.createMany({
    data: changed.map((change) => ({
      entityType: params.entityType,
      entityId: params.entityId,
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      dataSourceId: params.dataSourceId,
      runId: params.runId,
    })),
  });

  return changed.map((c) => c.field);
}

function serialiseValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return stableStringify(value);
  return String(value);
}
