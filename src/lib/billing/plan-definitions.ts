import type { PlanCode } from "@/generated/prisma/enums";

/**
 * Plan definitions and limits.
 *
 * Kept free of server-only imports so the reference-data seed script can use
 * the same definitions the application uses. These are seed values: once
 * seeded, plans are edited in the database and in admin, never here.
 */

export type PlanLimits = {
  searchesPerMonth: number;
  savedCompanies: number;
  savedSearches: number;
  alerts: number;
  exportsPerMonth: number;
  reportsPerMonth: number;
  seats: number;
  apiAccess: boolean;
  apiRequestsPerMonth: number;
  advancedFilters: boolean;
  bulkExport: boolean;
};

export const DEFAULT_LIMITS: PlanLimits = {
  searchesPerMonth: 25,
  savedCompanies: 5,
  savedSearches: 3,
  alerts: 1,
  exportsPerMonth: 0,
  reportsPerMonth: 0,
  seats: 1,
  apiAccess: false,
  apiRequestsPerMonth: 0,
  advancedFilters: false,
  bulkExport: false,
};

export type PlanSeed = {
  code: PlanCode;
  name: string;
  description: string;
  priceMonthlyPence: number | null;
  priceYearlyPence: number | null;
  sortOrder: number;
  features: string[];
  limits: PlanLimits;
};

export const DEFAULT_PLANS: PlanSeed[] = [
  {
    code: "FREE",
    name: "Free",
    description: "Explore Welsh company and contract data with monthly limits.",
    priceMonthlyPence: 0,
    priceYearlyPence: 0,
    sortOrder: 0,
    features: [
      "Company search across Wales",
      "Company profiles with source links",
      "Public procurement search",
      "1 saved alert",
    ],
    limits: DEFAULT_LIMITS,
  },
  {
    code: "PRO",
    name: "Pro",
    description: "For advisers and business developers tracking Welsh activity daily.",
    priceMonthlyPence: 4_900,
    priceYearlyPence: 49_000,
    sortOrder: 1,
    features: [
      "Unlimited searches",
      "100 saved companies",
      "20 alerts with email notifications",
      "CSV exports",
      "Advanced filters and radius search",
    ],
    limits: {
      searchesPerMonth: -1,
      savedCompanies: 100,
      savedSearches: 50,
      alerts: 20,
      exportsPerMonth: 50,
      reportsPerMonth: 20,
      seats: 1,
      apiAccess: false,
      apiRequestsPerMonth: 0,
      advancedFilters: true,
      bulkExport: false,
    },
  },
  {
    code: "BUSINESS",
    name: "Business",
    description: "For teams that need shared intelligence, reporting and API access.",
    priceMonthlyPence: 9_900,
    priceYearlyPence: 99_000,
    sortOrder: 2,
    features: [
      "Everything in Pro",
      "5 team members",
      "Unlimited saved companies and alerts",
      "Bulk export and scheduled reports",
      "API access",
    ],
    limits: {
      searchesPerMonth: -1,
      savedCompanies: -1,
      savedSearches: -1,
      alerts: -1,
      exportsPerMonth: -1,
      reportsPerMonth: -1,
      seats: 5,
      apiAccess: true,
      apiRequestsPerMonth: 50_000,
      advancedFilters: true,
      bulkExport: true,
    },
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    description: "Custom limits, additional datasets and priority support.",
    priceMonthlyPence: null,
    priceYearlyPence: null,
    sortOrder: 3,
    features: [
      "Everything in Business",
      "Custom seat count",
      "Custom datasets and onboarding",
      "Priority support",
    ],
    limits: {
      searchesPerMonth: -1,
      savedCompanies: -1,
      savedSearches: -1,
      alerts: -1,
      exportsPerMonth: -1,
      reportsPerMonth: -1,
      seats: -1,
      apiAccess: true,
      apiRequestsPerMonth: -1,
      advancedFilters: true,
      bulkExport: true,
    },
  },
];
