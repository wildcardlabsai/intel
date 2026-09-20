/**
 * Tabular export.
 *
 * One dataset description drives every output format, so a CSV, a spreadsheet
 * and a PDF of the same search always contain exactly the same rows in the
 * same order. Formatters live beside this file and take a dataset; they never
 * query anything themselves.
 *
 * Nothing here invents a value. A column whose source field is null renders as
 * an empty cell rather than a plausible-looking default.
 */

export type ExportCell = string | number | null;

export type ExportColumn<T> = {
  /** Machine-readable column name, used as the CSV and spreadsheet header. */
  key: string;
  /** Human heading used in the spreadsheet and PDF. */
  header: string;
  value: (row: T) => ExportCell;
  /** Preferred width in characters; formatters may adjust it. */
  width?: number;
  align?: "left" | "right";
  /**
   * Left out of the PDF. A page of A4 fits roughly ten legible columns, so a
   * wide dataset drops its least useful columns there rather than truncating
   * every column to nothing. CSV and XLSX always carry the full set.
   */
  omitFromPdf?: boolean;
  /**
   * Alternative rendering for the PDF, where a machine-readable value such as
   * a full ISO timestamp is too long to fit legibly. CSV and XLSX always use
   * `value`, so the exact value is never lost — only the printed view differs.
   */
  display?: (row: T) => ExportCell;
};

export type ExportDataset<T> = {
  title: string;
  /** Filename without an extension. */
  filename: string;
  /** Human description of the filters behind these rows. */
  criteria: string;
  /** Source names quoted in the footer, so exported data stays attributable. */
  sources: string[];
  /** When the underlying records were last read. */
  generatedAt: Date;
  /** Set when the row count was capped, so the export can say so. */
  truncatedAt?: number;
  columns: ExportColumn<T>[];
  rows: T[];
};

/**
 * Neutralises a value a spreadsheet would otherwise evaluate as a formula.
 *
 * Exported data is publisher-supplied text: a company name really can begin
 * with a hyphen. Prefixing a single quote keeps the value readable while
 * stopping Excel, Numbers and LibreOffice treating it as an expression.
 *
 * Numbers are passed through untouched. A negative coordinate is a value, not
 * a formula, and guarding it would stop the column parsing as numeric.
 */
export function sanitiseCell(value: ExportCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Renders one row as RFC 4180 CSV. */
export function toCsvRow(values: ExportCell[]): string {
  return values
    .map((value) => `"${sanitiseCell(value).replace(/"/g, '""')}"`)
    .join(",");
}

export function toCsv<T>(dataset: ExportDataset<T>): string {
  const header = dataset.columns.map((column) => column.key);
  const lines = [toCsvRow(header)];
  for (const row of dataset.rows) {
    lines.push(toCsvRow(dataset.columns.map((column) => column.value(row))));
  }
  return lines.join("\r\n");
}

/** The attribution line repeated at the foot of every export. */
export function attributionLine<T>(dataset: ExportDataset<T>): string {
  const sources = dataset.sources.length > 0 ? dataset.sources.join("; ") : "Cymru Intelligence";
  return (
    `Source: ${sources}. Exported from Cymru Intelligence on ` +
    `${dataset.generatedAt.toISOString().slice(0, 10)}. ` +
    `Contains public sector information licensed under the Open Government Licence v3.0.`
  );
}

export function exportFilename<T>(dataset: ExportDataset<T>, extension: string): string {
  const date = dataset.generatedAt.toISOString().slice(0, 10);
  return `${dataset.filename}-${date}.${extension}`;
}
