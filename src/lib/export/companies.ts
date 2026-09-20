import type { CompanySearchRow } from "@/lib/search/companies";
import type { ExportDataset } from "@/lib/export/dataset";
import { describeSavedSearch } from "@/lib/search/saved-search";
import type { CompanyFilters } from "@/lib/search/types";

/**
 * The company export dataset.
 *
 * Source and source URL are always the last two columns and are never
 * optional: an exported row that has left the platform must still say where it
 * came from, both for the Open Government Licence and so a reader can check it.
 */
export function companyExportDataset(
  rows: CompanySearchRow[],
  filters: CompanyFilters,
  options: { generatedAt?: Date; truncatedAt?: number } = {}
): ExportDataset<CompanySearchRow> {
  const { q, ...rest } = filters;
  const criteria = describeSavedSearch(q ?? null, rest as Record<string, unknown>);

  return {
    title: "Welsh companies",
    filename: "cymru-intelligence-companies",
    criteria,
    sources: ["Companies House (Open Government Licence v3.0)", "postcodes.io"],
    generatedAt: options.generatedAt ?? new Date(),
    truncatedAt: options.truncatedAt,
    rows,
    columns: [
      { key: "company_number", header: "Company no.", width: 14, value: (r) => r.companyNumber },
      { key: "name", header: "Name", width: 30, value: (r) => r.name },
      { key: "status", header: "Status", width: 12, value: (r) => r.status },
      {
        key: "incorporated_on",
        header: "Incorporated",
        width: 13,
        value: (r) => r.incorporatedOn?.toISOString().slice(0, 10) ?? null,
      },
      { key: "town", header: "Town", width: 14, value: (r) => r.town },
      { key: "postcode", header: "Postcode", width: 10, value: (r) => r.postcode },
      {
        key: "local_authority",
        header: "Local authority",
        width: 18,
        value: (r) => r.localAuthorityName,
      },
      { omitFromPdf: true, key: "region", header: "Region", width: 14, value: (r) => r.region },
      { key: "sic_codes", header: "SIC codes", width: 14, value: (r) => r.sicCodes.join(" ") },
      { omitFromPdf: true, key: "size_band", header: "Size", width: 10, value: (r) => r.sizeBand },
      { omitFromPdf: true, key: "latitude", header: "Latitude", width: 9, align: "right", value: (r) => r.latitude },
      { omitFromPdf: true, key: "longitude", header: "Longitude", width: 9, align: "right", value: (r) => r.longitude },
      { omitFromPdf: true, key: "source", header: "Source", width: 14, value: (r) => r.source },
      { key: "source_url", header: "Source URL", width: 26, value: (r) => r.sourceUrl },
      {
        key: "last_updated_at",
        header: "Last updated",
        width: 13,
        value: (r) => r.lastUpdatedAt.toISOString(),
        display: (r) => r.lastUpdatedAt.toISOString().slice(0, 10),
      },
    ],
  };
}
