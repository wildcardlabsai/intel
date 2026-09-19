import "server-only";

import { prisma } from "@/lib/db/prisma";
import {
  nameSimilarity,
  normaliseCompanyName,
  normaliseCompanyNumber,
} from "@/lib/normalise/company-name";

/**
 * Resolves an organisation named in one dataset (a procurement supplier, a
 * planning applicant, a funding recipient) to a company in our register.
 *
 * Priority:
 *   1. Companies House number — exact, confidence 1.0.
 *   2. Existing recorded alias — confidence 0.95.
 *   3. Exact normalised name, unique match — confidence 0.9, or 0.75 when the
 *      match is unique only after filtering to the same postcode/locality.
 *   4. Fuzzy normalised name above threshold, unambiguous — 0.6–0.85.
 *
 * Ambiguity is never resolved by guessing: when several companies match
 * equally well the function returns `null` with the candidates attached, and
 * the record is stored unresolved for an administrator to review. A wrong link
 * is far more damaging than a missing one.
 */

export const RESOLUTION_THRESHOLD = 0.72;

export type ResolutionInput = {
  name: string;
  companyNumber?: string | null;
  postcode?: string | null;
  locality?: string | null;
};

export type ResolutionCandidate = {
  companyId: string;
  companyNumber: string;
  name: string;
  score: number;
};

export type ResolutionResult = {
  companyId: string | null;
  confidence: number;
  method:
    | "company_number"
    | "alias"
    | "exact_name"
    | "exact_name_with_location"
    | "fuzzy_name"
    | "ambiguous"
    | "no_match";
  candidates: ResolutionCandidate[];
  /** Why this decision was made, stored alongside the link as evidence. */
  reason: string;
};

function unresolved(method: ResolutionResult["method"], reason: string, candidates: ResolutionCandidate[] = []): ResolutionResult {
  return { companyId: null, confidence: 0, method, candidates, reason };
}

export async function resolveCompany(input: ResolutionInput): Promise<ResolutionResult> {
  const normalisedName = normaliseCompanyName(input.name);
  const companyNumber = normaliseCompanyNumber(input.companyNumber);

  // 1. Company number is definitive.
  if (companyNumber) {
    const byNumber = await prisma.company.findUnique({
      where: { companyNumber },
      select: { id: true, companyNumber: true, name: true },
    });
    if (byNumber) {
      return {
        companyId: byNumber.id,
        confidence: 1,
        method: "company_number",
        candidates: [
          { companyId: byNumber.id, companyNumber: byNumber.companyNumber, name: byNumber.name, score: 1 },
        ],
        reason: `Matched on Companies House number ${companyNumber}.`,
      };
    }
    // A number was supplied but we have not ingested that company yet. Do not
    // fall through to name matching — the number is the stronger signal and
    // name matching here risks linking to the wrong company.
    return unresolved(
      "no_match",
      `Company number ${companyNumber} supplied but not present in the register yet.`
    );
  }

  if (!normalisedName) {
    return unresolved("no_match", "Name was empty after normalisation.");
  }

  // 2. A previously recorded alias.
  const alias = await prisma.companyAlias.findFirst({
    where: { normalisedAlias: normalisedName },
    select: { companyId: true, company: { select: { companyNumber: true, name: true } } },
  });
  if (alias) {
    return {
      companyId: alias.companyId,
      confidence: 0.95,
      method: "alias",
      candidates: [
        {
          companyId: alias.companyId,
          companyNumber: alias.company.companyNumber,
          name: alias.company.name,
          score: 0.95,
        },
      ],
      reason: `Matched a recorded alias for "${input.name}".`,
    };
  }

  // 3. Exact normalised name.
  const exactMatches = await prisma.company.findMany({
    where: { normalisedName },
    select: { id: true, companyNumber: true, name: true, postcode: true, town: true },
    take: 25,
  });

  if (exactMatches.length === 1) {
    const match = exactMatches[0];
    return {
      companyId: match.id,
      confidence: 0.9,
      method: "exact_name",
      candidates: [{ companyId: match.id, companyNumber: match.companyNumber, name: match.name, score: 0.9 }],
      reason: `Unique exact match on normalised name "${normalisedName}".`,
    };
  }

  if (exactMatches.length > 1) {
    // Try to disambiguate on location before giving up.
    const postcode = input.postcode?.toUpperCase().replace(/\s+/g, "");
    const locality = input.locality?.toUpperCase();

    const locationMatches = exactMatches.filter((candidate) => {
      const candidatePostcode = candidate.postcode?.toUpperCase().replace(/\s+/g, "");
      if (postcode && candidatePostcode && candidatePostcode === postcode) return true;
      if (locality && candidate.town && candidate.town.toUpperCase() === locality) return true;
      return false;
    });

    if (locationMatches.length === 1) {
      const match = locationMatches[0];
      return {
        companyId: match.id,
        confidence: 0.75,
        method: "exact_name_with_location",
        candidates: [
          { companyId: match.id, companyNumber: match.companyNumber, name: match.name, score: 0.75 },
        ],
        reason:
          `${exactMatches.length} companies share the normalised name ` +
          `"${normalisedName}"; disambiguated by ${postcode ? "postcode" : "locality"}.`,
      };
    }

    return unresolved(
      "ambiguous",
      `${exactMatches.length} companies share the normalised name "${normalisedName}" ` +
        `and the record has no location that separates them. Left unresolved for review.`,
      exactMatches.map((c) => ({
        companyId: c.id,
        companyNumber: c.companyNumber,
        name: c.name,
        score: 0.9,
      }))
    );
  }

  // 4. Fuzzy match using the pg_trgm index. The similarity() threshold is
  // applied in SQL so the GIN index does the work.
  const fuzzy = await prisma.$queryRaw<
    Array<{ id: string; company_number: string; name: string; normalised_name: string; score: number }>
  >`
    SELECT id, company_number, name, normalised_name,
           similarity(normalised_name, ${normalisedName}) AS score
    FROM companies
    WHERE normalised_name % ${normalisedName}
    ORDER BY score DESC
    LIMIT 10
  `;

  const scored: ResolutionCandidate[] = fuzzy
    .map((row) => ({
      companyId: row.id,
      companyNumber: row.company_number,
      name: row.name,
      // Combine trigram similarity with token-set similarity: trigrams handle
      // typos, token sets handle word order and added words.
      score: Math.min(
        1,
        0.5 * Number(row.score) + 0.5 * nameSimilarity(normalisedName, row.normalised_name)
      ),
    }))
    .filter((candidate) => candidate.score >= RESOLUTION_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return unresolved("no_match", `No company scored above ${RESOLUTION_THRESHOLD} for "${input.name}".`);
  }

  const [best, runnerUp] = scored;

  // Require a clear winner. Two near-identical scores mean we cannot tell the
  // companies apart, so we refuse rather than pick one.
  if (runnerUp && best.score - runnerUp.score < 0.08) {
    return unresolved(
      "ambiguous",
      `Top two fuzzy matches for "${input.name}" scored ${best.score.toFixed(2)} and ` +
        `${runnerUp.score.toFixed(2)} — too close to call. Left unresolved for review.`,
      scored
    );
  }

  return {
    companyId: best.companyId,
    confidence: Number(best.score.toFixed(3)),
    method: "fuzzy_name",
    candidates: scored,
    reason:
      `Fuzzy name match: "${input.name}" → "${best.name}" ` +
      `(${best.companyNumber}) scored ${best.score.toFixed(2)}.`,
  };
}

/**
 * Records a confirmed link so the next occurrence of the same spelling
 * resolves instantly and identically.
 */
export async function recordAlias(
  companyId: string,
  alias: string,
  source: string,
  confidence: number
): Promise<void> {
  const normalisedAlias = normaliseCompanyName(alias);
  if (!normalisedAlias) return;

  await prisma.companyAlias.upsert({
    where: { companyId_normalisedAlias: { companyId, normalisedAlias } },
    create: { companyId, alias, normalisedAlias, source, confidence },
    update: { confidence },
  });
}

/** Writes an edge into the cross-source intelligence graph. */
export async function linkEntities(params: {
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  relation: string;
  confidence: number;
  method?: string;
  evidence?: Record<string, unknown>;
}): Promise<void> {
  const { fromType, fromId, toType, toId, relation, confidence, method, evidence } = params;
  await prisma.entityLink.upsert({
    where: {
      fromType_fromId_toType_toId_relation: { fromType, fromId, toType, toId, relation },
    },
    create: {
      fromType,
      fromId,
      toType,
      toId,
      relation,
      confidence,
      method,
      evidence: (evidence ?? {}) as never,
    },
    update: { confidence, method, evidence: (evidence ?? {}) as never },
  });
}
