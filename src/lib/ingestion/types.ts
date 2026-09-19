import type { ImportStage, ImportTrigger } from "@/generated/prisma/enums";
import type { ChildLogger } from "@/lib/logger";

/**
 * Every connector implements this contract, and the runner drives all of them
 * through the same pipeline:
 *
 *   FETCH → VALIDATE → NORMALISE → DEDUPLICATE → RESOLVE → STORE → INDEX → LOG
 *
 * Connectors own the publisher-specific parts (`fetch`, `validate`,
 * `normalise`, `store`); the runner owns transactions, error isolation,
 * provenance, counters and telemetry, so those behave identically everywhere.
 */

export type ConnectorContext = {
  /** Resume point from the previous successful run, if the connector uses one. */
  cursor: string | null;
  /** Caps work per invocation so a cron run cannot exceed its time budget. */
  limit: number;
  trigger: ImportTrigger;
  runId: string;
  dataSourceId: string;
  logger: ChildLogger;
  /** Set when the platform is shutting the invocation down. */
  signal?: AbortSignal;
};

/** One record as published, with the identity fields the runner needs. */
export type FetchedRecord<TRaw> = {
  /** Publisher's own stable identifier for this record. */
  sourceRecordId: string;
  /** Canonical URL a user can visit to see this record at the publisher. */
  sourceUrl?: string | null;
  /** Publisher's own last-modified timestamp, when it provides one. */
  sourceUpdatedAt?: Date | null;
  raw: TRaw;
};

export type ValidationResult<TRaw> =
  | { ok: true; value: FetchedRecord<TRaw> }
  | { ok: false; reason: string };

export type StoreOutcome = "created" | "updated" | "skipped";

export type StoreContext = ConnectorContext & {
  /** Id of the RawRecord row holding the verbatim payload. */
  rawRecordId: string;
};

export interface Connector<TRaw, TNormalised> {
  /** Stable key, also used as the DataSource.key for single-source connectors. */
  readonly key: string;
  readonly dataSourceKey: string;
  readonly label: string;

  /**
   * Returns the reason this connector cannot run right now (a missing API key,
   * an unavailable publisher feed), or null when it is ready. Checked before
   * every run so the UI can report NOT_CONFIGURED honestly.
   */
  readiness(): { ready: true } | { ready: false; reason: string; missingEnvVars: string[] };

  /** Streams records from the publisher. Pagination lives here. */
  fetch(context: ConnectorContext): AsyncGenerator<FetchedRecord<TRaw>, string | null, void>;

  /** Rejects structurally invalid records without aborting the run. */
  validate(record: FetchedRecord<TRaw>): ValidationResult<TRaw>;

  /** Maps the publisher's shape onto ours. Pure: no I/O, so it is unit-testable. */
  normalise(record: FetchedRecord<TRaw>): TNormalised;

  /**
   * Upserts the normalised record. Must be idempotent — the same input twice
   * produces "created" then "updated", never a duplicate row.
   */
  store(normalised: TNormalised, context: StoreContext): Promise<StoreOutcome>;

  /** Optional post-run work: refresh aggregates, rebuild derived rows. */
  afterRun?(context: ConnectorContext & { counters: RunCounters }): Promise<void>;
}

export type RunCounters = {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  rejected: number;
};

export type RecordFailure = {
  stage: ImportStage;
  sourceRecordId: string | null;
  message: string;
  payload?: unknown;
};

export type RunResult = {
  runId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  counters: RunCounters;
  cursor: string | null;
  durationMs: number;
  errors: RecordFailure[];
  /** Present when the run could not start at all. */
  notConfiguredReason?: string;
};
