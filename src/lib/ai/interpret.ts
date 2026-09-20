import "server-only";

import { QUERY_MODEL, getAnthropicClient } from "@/lib/ai/client";
import {
  buildSystemPrompt,
  buildVocabulary,
  interpretationSchema,
  isEmptyInterpretation,
  validateInterpretation,
  type Interpretation,
} from "@/lib/ai/query-interpreter";
import { INTEGRATIONS, getIntegrationStatuses, IntegrationNotConfiguredError } from "@/lib/env";
import { logger } from "@/lib/logger";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

/**
 * Runs a natural-language phrase through the model and returns validated
 * filters.
 *
 * Every outcome other than `interpreted` leaves the caller with plain keyword
 * search, which always works. The AI layer is an accelerator, never a
 * dependency: if it is unconfigured, times out or errors, the search still
 * runs — it simply searches for the words the user typed.
 */

export type InterpretResult =
  | { status: "interpreted"; interpretation: Interpretation }
  | { status: "not_configured"; missingEnvVars: string[] }
  | { status: "no_filters"; interpretation: Interpretation }
  | { status: "failed"; reason: string };

const TIMEOUT_MS = 12_000;

export async function interpretCompanyQuery(
  phrase: string,
  localAuthorities: Array<{ slug: string; name: string; welshName?: string | null }>
): Promise<InterpretResult> {
  const trimmed = phrase.trim();
  if (trimmed.length === 0) {
    return { status: "failed", reason: "Nothing to interpret." };
  }

  const status = getIntegrationStatuses().find((entry) => entry.key === INTEGRATIONS.ai);
  if (!status?.configured) {
    return { status: "not_configured", missingEnvVars: status?.missingEnvVars ?? [] };
  }

  const vocabulary = buildVocabulary(localAuthorities);

  try {
    const client = getAnthropicClient();

    const response = await client.messages.parse(
      {
        model: QUERY_MODEL,
        max_tokens: 2_000,
        system: buildSystemPrompt(vocabulary),
        // Interpretation is a short, constrained extraction; it does not need
        // deep reasoning, and low effort keeps the search feeling instant.
        output_config: {
          effort: "low",
          format: zodOutputFormat(interpretationSchema),
        },
        messages: [{ role: "user", content: trimmed.slice(0, 500) }],
      },
      { timeout: TIMEOUT_MS }
    );

    if (response.stop_reason === "refusal") {
      return { status: "failed", reason: "The phrase could not be interpreted." };
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      return { status: "failed", reason: "The interpretation did not match the expected shape." };
    }

    const interpretation = validateInterpretation(parsed, vocabulary);

    if (isEmptyInterpretation(interpretation)) {
      return { status: "no_filters", interpretation };
    }

    return { status: "interpreted", interpretation };
  } catch (error) {
    if (error instanceof IntegrationNotConfiguredError) {
      return { status: "not_configured", missingEnvVars: error.missingEnvVars };
    }
    logger.error("query interpretation failed", error);
    return { status: "failed", reason: "Interpretation is unavailable just now." };
  }
}
