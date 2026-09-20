import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import type { ApiKey, User } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getEntitlements } from "@/lib/billing/plans";
import type { SessionUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

/**
 * API key authentication for /api/v1.
 *
 * Keys are shown to the user exactly once at creation and stored only as a
 * SHA-256 hash. Lookup is by the (unique, non-secret) prefix so the hash
 * comparison happens on a single candidate in constant time, rather than
 * scanning the table.
 */

const KEY_PREFIX = "ci_live_";
const PREFIX_VISIBLE_CHARS = 8;

export type GeneratedApiKey = {
  /** Shown once. Never stored. */
  plaintext: string;
  prefix: string;
  hashedKey: string;
};

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(24).toString("base64url");
  const plaintext = `${KEY_PREFIX}${secret}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, KEY_PREFIX.length + PREFIX_VISIBLE_CHARS),
    hashedKey: hashApiKey(plaintext),
  };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export type ApiAuthResult =
  | { ok: true; apiKey: ApiKey; user: SessionUser }
  | { ok: false; response: NextResponse };

function errorResponse(status: number, error: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, message, ...extra }, { status });
}

/**
 * Authenticates a request, enforces the plan's API entitlement, and applies a
 * per-key request rate limit.
 */
export async function authenticateApiRequest(request: Request): Promise<ApiAuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : (request.headers.get("x-api-key") ?? "").trim();

  if (!provided) {
    return {
      ok: false,
      response: errorResponse(
        401,
        "missing_api_key",
        "Provide your API key as `Authorization: Bearer <key>` or `X-API-Key: <key>`."
      ),
    };
  }

  const prefix = provided.slice(0, KEY_PREFIX.length + PREFIX_VISIBLE_CHARS);
  const candidate = await prisma.apiKey.findUnique({
    where: { prefix },
    include: {
      user: {
        include: { organisation: { select: { name: true } } },
      },
    },
  });

  if (!candidate || !constantTimeEquals(hashApiKey(provided), candidate.hashedKey)) {
    logger.info("api key rejected", { prefix });
    return { ok: false, response: errorResponse(401, "invalid_api_key", "That API key is not valid.") };
  }

  if (candidate.revokedAt) {
    return { ok: false, response: errorResponse(401, "revoked_api_key", "This API key has been revoked.") };
  }

  if (candidate.expiresAt && candidate.expiresAt.getTime() < Date.now()) {
    return { ok: false, response: errorResponse(401, "expired_api_key", "This API key has expired.") };
  }

  const user = candidate.user as User & { organisation: { name: string } | null };
  if (user.deletedAt) {
    return { ok: false, response: errorResponse(401, "account_closed", "This account is closed.") };
  }

  const sessionUser: SessionUser = {
    id: user.id,
    authId: user.authId,
    email: user.email,
    name: user.name,
    role: user.role,
    organisationId: user.organisationId,
    organisationName: user.organisation?.name ?? null,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  };

  const entitlements = await getEntitlements(sessionUser);
  if (!entitlements.limits.apiAccess) {
    return {
      ok: false,
      response: errorResponse(
        403,
        "api_not_included",
        `API access is not included in the ${entitlements.planName} plan. Upgrade to Business or Enterprise.`,
        { plan: entitlements.planCode }
      ),
    };
  }

  const rateLimit = await checkApiRateLimit(candidate.id, candidate.rateLimitPerMinute);
  if (!rateLimit.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "rate_limited",
          message: `Rate limit of ${candidate.rateLimitPerMinute} requests per minute exceeded.`,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "retry-after": String(rateLimit.retryAfterSeconds),
            "x-ratelimit-limit": String(candidate.rateLimitPerMinute),
            "x-ratelimit-remaining": "0",
          },
        }
      ),
    };
  }

  // Monthly quota from the plan.
  const monthlyLimit = entitlements.limits.apiRequestsPerMonth;
  if (monthlyLimit !== -1) {
    const used = await countMonthlyApiCalls(sessionUser.id, sessionUser.organisationId);
    if (used >= monthlyLimit) {
      return {
        ok: false,
        response: errorResponse(
          429,
          "quota_exceeded",
          `Your ${entitlements.planName} plan includes ${monthlyLimit} API requests per month.`,
          { used, limit: monthlyLimit }
        ),
      };
    }
  }

  await prisma.apiKey.update({
    where: { id: candidate.id },
    data: { lastUsedAt: new Date() },
  });

  return { ok: true, apiKey: candidate, user: sessionUser };
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

async function countMonthlyApiCalls(userId: string, organisationId: string | null): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return prisma.usageEvent.count({
    where: {
      kind: "API_CALL",
      createdAt: { gte: monthStart },
      OR: [...(organisationId ? [{ organisationId }] : []), { userId }],
    },
  });
}

/**
 * Per-minute rate limit, counted from usage_events so the limit is shared
 * across serverless instances rather than being per-process.
 */
async function checkApiRateLimit(
  apiKeyId: string,
  limitPerMinute: number
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const windowStart = new Date(Date.now() - 60_000);
  const count = await prisma.usageEvent.count({
    where: { apiKeyId, kind: "API_CALL", createdAt: { gte: windowStart } },
  });

  return count < limitPerMinute
    ? { allowed: true, retryAfterSeconds: 0 }
    : { allowed: false, retryAfterSeconds: 60 };
}

/** Records an API call for quota and analytics. */
export async function recordApiCall(
  apiKey: ApiKey,
  user: SessionUser,
  endpoint: string,
  status: number
): Promise<void> {
  await prisma.usageEvent.create({
    data: {
      userId: user.id,
      organisationId: user.organisationId,
      apiKeyId: apiKey.id,
      kind: "API_CALL",
      metadata: { endpoint, status },
    },
  });
}

/** Standard JSON envelope so every endpoint responds the same shape. */
export function apiResponse<T>(
  data: T,
  meta: Record<string, unknown> = {},
  init: ResponseInit = {}
): NextResponse {
  return NextResponse.json(
    {
      data,
      meta: {
        ...meta,
        // Attribution travels with the data, as the licences require.
        attribution:
          "Contains public sector information licensed under the Open Government Licence v3.0. " +
          "Sources are named on each record.",
      },
    },
    init
  );
}
