import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Formats a money amount, or a dash when the publisher did not report one. */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string | null = "GBP",
  options: { compact?: boolean } = {}
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    maximumFractionDigits: 0,
    notation: options.compact && Math.abs(value) >= 1_000_000 ? "compact" : "standard",
  }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB").format(value);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

/** "3 days ago" / "in 2 months" — used for data freshness labels. */
export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "never";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "never";

  const diffMs = value.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const formatter = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

  const thresholds: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "minute"],
    [24 * 60, "hour"],
    [30 * 24 * 60, "day"],
    [365 * 24 * 60, "month"],
  ];

  const absolute = Math.abs(diffMinutes);
  if (absolute < 1) return "just now";
  if (absolute < 60) return formatter.format(diffMinutes, "minute");
  if (absolute < thresholds[1][0]) return formatter.format(Math.round(diffMinutes / 60), "hour");
  if (absolute < thresholds[2][0]) return formatter.format(Math.round(diffMinutes / (60 * 24)), "day");
  if (absolute < thresholds[3][0])
    return formatter.format(Math.round(diffMinutes / (60 * 24 * 30)), "month");
  return formatter.format(Math.round(diffMinutes / (60 * 24 * 365)), "year");
}

/** Converts an enum-ish value into display text: SOUTH_WALES → South Wales. */
export function humanise(value: string | null | undefined): string {
  if (!value) return "—";
  const spaced = value.replace(/[_-]+/g, " ").toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural ?? `${singular}s`;
}
