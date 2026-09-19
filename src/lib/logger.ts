/**
 * Minimal structured logger. Emits one JSON object per line so logs are
 * queryable in Vercel / Supabase log drains without extra tooling.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function currentLevel(): Level {
  const raw = process.env.LOG_LEVEL;
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

export type LogContext = Record<string, unknown>;

function serialiseError(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    };
  }
  return { error: String(error) };
}

function emit(level: Level, message: string, context: LogContext = {}): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel()]) return;

  const payload = {
    level,
    time: new Date().toISOString(),
    message,
    ...context,
  };

  const line = JSON.stringify(payload, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, error?: unknown, context?: LogContext) =>
    emit("error", message, { ...context, ...(error ? serialiseError(error) : {}) }),
  /** Returns a logger that stamps every line with the given context. */
  child: (base: LogContext) => ({
    debug: (message: string, context?: LogContext) => emit("debug", message, { ...base, ...context }),
    info: (message: string, context?: LogContext) => emit("info", message, { ...base, ...context }),
    warn: (message: string, context?: LogContext) => emit("warn", message, { ...base, ...context }),
    error: (message: string, error?: unknown, context?: LogContext) =>
      emit("error", message, { ...base, ...context, ...(error ? serialiseError(error) : {}) }),
  }),
};

export type Logger = typeof logger;
export type ChildLogger = ReturnType<typeof logger.child>;
