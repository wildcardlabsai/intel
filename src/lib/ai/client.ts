import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { INTEGRATIONS, getEnv, requireIntegration } from "@/lib/env";

/**
 * Anthropic client.
 *
 * Constructed lazily so importing anything in this directory does not require
 * an API key: the query interpreter reports itself as "Not configured" rather
 * than throwing at import time.
 *
 * The key is read from the server environment only. It is never sent to the
 * browser, and no client component imports anything from this directory.
 */

let cached: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  requireIntegration(INTEGRATIONS.ai);
  if (!cached) {
    cached = new Anthropic({ apiKey: getEnv().ANTHROPIC_API_KEY });
  }
  return cached;
}

/**
 * The model used for query interpretation.
 *
 * Interpretation is a short, constrained extraction, so it is cheap to run at
 * low effort. The model is configurable because the right cost/quality point
 * is an operator decision, not one to bake into the code.
 */
export const QUERY_MODEL = "claude-opus-5";
