import { logger } from "@/lib/logger";
import { getRateLimiter } from "@/lib/http/rate-limiter";

/**
 * HTTP client for publisher APIs.
 *
 * Responsibilities: rate limiting against the publisher's documented limit,
 * retry with exponential backoff and jitter, honouring Retry-After, request
 * logging, and a hard timeout so a hung upstream cannot stall a cron run.
 */

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: string;
  readonly retryable: boolean;

  constructor(status: number, url: string, body: string, retryable: boolean) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.body = body;
    this.retryable = retryable;
  }
}

export type HttpClientOptions = {
  /** Name used for the shared rate limiter and log lines, e.g. "companies_house". */
  name: string;
  baseUrl: string;
  /** Headers sent on every request (auth, accept, user-agent). */
  defaultHeaders?: Record<string, string>;
  rateLimit?: { limit: number; windowMs: number };
  maxRetries?: number;
  timeoutMs?: number;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests so backoff does not use real timers. */
  sleepImpl?: (ms: number) => Promise<void>;
};

export type RequestOptions = {
  method?: "GET" | "POST";
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  body?: unknown;
  /** Treat these statuses as a successful "absent" result rather than an error. */
  notFoundStatuses?: number[];
  /**
   * Caller's abort signal, in addition to the client's own timeout. Used when
   * the platform is shutting an invocation down mid-run.
   */
  signal?: AbortSignal;
};

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 4;

export class HttpClient {
  private readonly options: Required<
    Omit<HttpClientOptions, "rateLimit" | "defaultHeaders">
  > & {
    rateLimit?: { limit: number; windowMs: number };
    defaultHeaders: Record<string, string>;
  };

  constructor(options: HttpClientOptions) {
    this.options = {
      name: options.name,
      baseUrl: options.baseUrl.replace(/\/+$/, ""),
      defaultHeaders: options.defaultHeaders ?? {},
      rateLimit: options.rateLimit,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      fetchImpl: options.fetchImpl ?? fetch,
      sleepImpl: options.sleepImpl ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    };
  }

  buildUrl(path: string, query?: RequestOptions["query"]): string {
    const url = new URL(
      path.startsWith("http") ? path : `${this.options.baseUrl}/${path.replace(/^\/+/, "")}`
    );
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === "") continue;
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  /**
   * Performs a request and parses JSON. Returns `null` when the response
   * status is listed in `notFoundStatuses` (default: 404), which lets callers
   * distinguish "publisher has no such record" from "request failed".
   */
  async getJson<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
    const response = await this.request(path, options);
    if (response === null) return null;
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(
        `Failed to parse JSON from ${this.options.name} (${path}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getText(path: string, options: RequestOptions = {}): Promise<string | null> {
    const response = await this.request(path, options);
    if (response === null) return null;
    return response.text();
  }

  private async request(path: string, options: RequestOptions): Promise<Response | null> {
    const url = this.buildUrl(path, options.query);
    const notFound = new Set(options.notFoundStatuses ?? [404]);
    const log = logger.child({ upstream: this.options.name });

    let attempt = 0;
    let lastError: unknown;

    for (;;) {
      if (this.options.rateLimit) {
        const limiter = getRateLimiter(
          this.options.name,
          this.options.rateLimit.limit,
          this.options.rateLimit.windowMs
        );
        await limiter.acquire(this.options.sleepImpl);
      }

      const startedAt = Date.now();
      if (options.signal?.aborted) {
        throw new Error(`Request to ${this.options.name} aborted before it was sent.`);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
      // The caller's signal aborts this attempt too, so a shutdown is not left
      // waiting on the full timeout.
      const abortFromCaller = () => controller.abort();
      options.signal?.addEventListener("abort", abortFromCaller, { once: true });

      try {
        const response = await this.options.fetchImpl(url, {
          method: options.method ?? "GET",
          headers: {
            ...this.options.defaultHeaders,
            ...(options.headers ?? {}),
            ...(options.body ? { "content-type": "application/json" } : {}),
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        const durationMs = Date.now() - startedAt;

        if (response.ok) {
          log.debug("upstream request ok", { url, status: response.status, durationMs, attempt });
          return response;
        }

        if (notFound.has(response.status)) {
          log.debug("upstream record absent", { url, status: response.status, durationMs });
          return null;
        }

        const body = await response.text().catch(() => "");
        const retryable = RETRYABLE_STATUSES.has(response.status);
        log.warn("upstream request failed", {
          url,
          status: response.status,
          durationMs,
          attempt,
          retryable,
          body: body.slice(0, 500),
        });

        if (!retryable || attempt >= this.options.maxRetries) {
          throw new HttpError(response.status, url, body, retryable);
        }

        const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
        await this.options.sleepImpl(retryAfterMs ?? backoffMs(attempt));
        lastError = new HttpError(response.status, url, body, retryable);
      } catch (error) {
        if (error instanceof HttpError && !error.retryable) throw error;

        const isAbort = error instanceof Error && error.name === "AbortError";
        lastError = error;

        if (attempt >= this.options.maxRetries) {
          log.error("upstream request exhausted retries", error, { url, attempt });
          throw error;
        }

        log.warn("upstream request error, retrying", {
          url,
          attempt,
          timedOut: isAbort,
          message: error instanceof Error ? error.message : String(error),
        });
        await this.options.sleepImpl(backoffMs(attempt));
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", abortFromCaller);
      }

      attempt += 1;
      if (attempt > this.options.maxRetries) {
        throw lastError instanceof Error
          ? lastError
          : new Error(`Request to ${url} failed after ${attempt} attempts`);
      }
    }
  }
}

/** Exponential backoff with full jitter, capped at 30s. */
export function backoffMs(attempt: number, baseMs = 500, capMs = 30_000): number {
  const exponential = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.floor(Math.random() * exponential);
}

/** Retry-After may be seconds or an HTTP date. Returns milliseconds. */
export function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 300_000);
  }

  const date = Date.parse(header);
  if (Number.isFinite(date)) {
    return Math.max(0, Math.min(date - Date.now(), 300_000));
  }

  return null;
}
