import "server-only";

import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import type { ResolvedMetric } from "@/lib/insights/template";
import { formatCurrency, formatNumber } from "@/lib/utils";

/**
 * The metrics an insight may quote.
 *
 * This is a closed registry, not arbitrary SQL. An author picks a metric and
 * supplies its parameters; the query itself is written here, reviewed like any
 * other code, and executed through Prisma. That rules out both SQL injection
 * through the authoring UI and the subtler problem of a published figure whose
 * query nobody can reconstruct later.
 *
 * Every metric records a plain description of exactly what it counted, which
 * is stored with the resolved figure so a reader — or a later editor — can
 * check it.
 */

export type MetricParamDefinition = {
  name: string;
  label: string;
  /** Where the author picks from a fixed list, rather than typing freely. */
  options?: Array<{ value: string; label: string }>;
  type: "select" | "year";
  optional?: boolean;
};

export type MetricDefinition = {
  key: string;
  label: string;
  description: string;
  params: MetricParamDefinition[];
  /** Human description of the query, with the chosen parameters filled in. */
  describe: (params: Record<string, string>) => string;
  run: (params: Record<string, string>) => Promise<{ value: number; formatted: string }>;
};

const REGION_OPTIONS = [
  { value: "NORTH_WALES", label: "North Wales" },
  { value: "MID_WALES", label: "Mid Wales" },
  { value: "WEST_WALES", label: "West Wales" },
  { value: "SOUTH_WALES", label: "South Wales" },
  { value: "SOUTH_EAST_WALES", label: "South East Wales" },
];

const yearSchema = z.coerce.number().int().min(1850).max(2200);

function yearRange(year: string): { gte: Date; lt: Date } {
  const parsed = yearSchema.parse(year);
  return {
    gte: new Date(Date.UTC(parsed, 0, 1)),
    lt: new Date(Date.UTC(parsed + 1, 0, 1)),
  };
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    key: "companies_total",
    label: "Welsh companies on record",
    description: "Every company classified as Welsh from its registered address.",
    params: [],
    describe: () => "Count of companies where is_welsh = true.",
    run: async () => {
      const value = await prisma.company.count({ where: { isWelsh: true } });
      return { value, formatted: formatNumber(value) };
    },
  },
  {
    key: "companies_active",
    label: "Active Welsh companies",
    description: "Welsh companies whose Companies House status is Active.",
    params: [],
    describe: () => "Count of companies where is_welsh = true and status = 'ACTIVE'.",
    run: async () => {
      const value = await prisma.company.count({ where: { isWelsh: true, status: "ACTIVE" } });
      return { value, formatted: formatNumber(value) };
    },
  },
  {
    key: "companies_incorporated_in_year",
    label: "Welsh companies incorporated in a year",
    description: "New incorporations with a Welsh registered address in one calendar year.",
    params: [{ name: "year", label: "Year", type: "year" }],
    describe: (params) =>
      `Count of companies where is_welsh = true and incorporated_on falls in ${params.year}.`,
    run: async (params) => {
      const range = yearRange(params.year ?? "");
      const value = await prisma.company.count({
        where: { isWelsh: true, incorporatedOn: range },
      });
      return { value, formatted: formatNumber(value) };
    },
  },
  {
    key: "companies_in_region",
    label: "Welsh companies in a region",
    description: "Companies whose registered address falls in one region.",
    params: [{ name: "region", label: "Region", type: "select", options: REGION_OPTIONS }],
    describe: (params) =>
      `Count of companies where is_welsh = true and region = '${params.region}'.`,
    run: async (params) => {
      const region = z
        .enum(["NORTH_WALES", "MID_WALES", "WEST_WALES", "SOUTH_WALES", "SOUTH_EAST_WALES"])
        .parse(params.region);
      const value = await prisma.company.count({ where: { isWelsh: true, region } });
      return { value, formatted: formatNumber(value) };
    },
  },
  {
    key: "procurement_notices_total",
    label: "Procurement notices on record",
    description: "Every contract notice ingested from Sell2Wales.",
    params: [],
    describe: () => "Count of rows in procurement_notices.",
    run: async () => {
      const value = await prisma.procurementNotice.count();
      return { value, formatted: formatNumber(value) };
    },
  },
  {
    key: "procurement_awards_in_year",
    label: "Contracts awarded in a year",
    description: "Awards with an award date in one calendar year.",
    params: [{ name: "year", label: "Year", type: "year" }],
    describe: (params) =>
      `Count of procurement_awards where awarded_at falls in ${params.year}.`,
    run: async (params) => {
      const value = await prisma.procurementAward.count({
        where: { awardedAt: yearRange(params.year ?? "") },
      });
      return { value, formatted: formatNumber(value) };
    },
  },
  {
    key: "procurement_award_value_in_year",
    label: "Total awarded contract value in a year",
    description:
      "Sum of award values for one calendar year. Awards published without a value are excluded, never estimated.",
    params: [{ name: "year", label: "Year", type: "year" }],
    describe: (params) =>
      `Sum of value_amount over procurement_awards where awarded_at falls in ${params.year}. ` +
      "Rows with a null value are excluded rather than estimated.",
    run: async (params) => {
      const result = await prisma.procurementAward.aggregate({
        where: { awardedAt: yearRange(params.year ?? "") },
        _sum: { valueAmount: true },
      });
      const value = Number(result._sum.valueAmount ?? 0);
      return { value, formatted: formatCurrency(value) };
    },
  },
  {
    key: "planning_applications_total",
    label: "Planning applications on record",
    description: "Applications ingested from authorities with a configured feed.",
    params: [],
    describe: () =>
      "Count of rows in planning_applications. Covers only authorities with a configured feed.",
    run: async () => {
      const value = await prisma.planningApplication.count();
      return { value, formatted: formatNumber(value) };
    },
  },
  {
    key: "planning_authorities_connected",
    label: "Planning authorities connected",
    description: "How many of the 25 Welsh planning authorities have a working feed.",
    params: [],
    describe: () => "Count of planning_authorities where status = 'CONNECTED'.",
    run: async () => {
      const value = await prisma.planningAuthority.count({ where: { status: "CONNECTED" } });
      return { value, formatted: formatNumber(value) };
    },
  },
  {
    key: "funding_opportunities_open",
    label: "Open funding opportunities",
    description: "Schemes currently marked open by their publisher.",
    params: [],
    describe: () => "Count of funding_opportunities where status = 'OPEN'.",
    run: async () => {
      const value = await prisma.fundingOpportunity.count({ where: { status: "OPEN" } });
      return { value, formatted: formatNumber(value) };
    },
  },
];

export function getMetricDefinition(key: string): MetricDefinition | undefined {
  return METRIC_DEFINITIONS.find((definition) => definition.key === key);
}

export type MetricRequest = { key: string; params: Record<string, string> };

/**
 * Runs each requested metric and returns the figure together with the query
 * behind it. A metric that fails is reported rather than silently omitted:
 * publishing must not quietly drop a figure the body refers to.
 */
export async function resolveMetrics(
  requests: MetricRequest[]
): Promise<{ resolved: ResolvedMetric[]; failures: Array<{ key: string; reason: string }> }> {
  const resolved: ResolvedMetric[] = [];
  const failures: Array<{ key: string; reason: string }> = [];
  const computedAt = new Date().toISOString();

  for (const request of requests) {
    const definition = getMetricDefinition(request.key);
    if (!definition) {
      failures.push({ key: request.key, reason: "No such metric." });
      continue;
    }

    try {
      const { value, formatted } = await definition.run(request.params);
      resolved.push({
        key: definition.key,
        label: definition.label,
        formatted,
        value,
        query: definition.describe(request.params),
        computedAt,
      });
    } catch (error) {
      failures.push({
        key: request.key,
        reason: error instanceof Error ? error.message : "Could not be computed.",
      });
    }
  }

  return { resolved, failures };
}
