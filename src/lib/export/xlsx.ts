import "server-only";

import ExcelJS from "exceljs";

import {
  attributionLine,
  sanitiseCell,
  type ExportDataset,
} from "@/lib/export/dataset";

/**
 * Spreadsheet export.
 *
 * The first sheet holds the data with a frozen, filterable header row. A
 * second "About this export" sheet records what was searched for, when, and
 * which sources the rows came from — so a spreadsheet that has been emailed on
 * still carries its provenance and licence.
 */
export async function toXlsx<T>(dataset: ExportDataset<T>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cymru Intelligence";
  workbook.created = dataset.generatedAt;

  const sheet = workbook.addWorksheet("Data", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = dataset.columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width ?? 18,
    style: column.align === "right" ? { alignment: { horizontal: "right" } } : undefined,
  }));

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF102A23" },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFF4F3EC" } };

  for (const row of dataset.rows) {
    sheet.addRow(
      dataset.columns.map((column) => {
        const value = column.value(row);
        // Numbers stay numbers so the spreadsheet can total and sort them;
        // everything else is guarded against formula interpretation.
        return typeof value === "number" ? value : sanitiseCell(value);
      })
    );
  }

  if (dataset.rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: dataset.columns.length },
    };
  }

  const about = workbook.addWorksheet("About this export");
  about.columns = [{ width: 24 }, { width: 100 }];

  const facts: Array<[string, string]> = [
    ["Export", dataset.title],
    ["Search criteria", dataset.criteria],
    ["Rows", String(dataset.rows.length)],
    ["Generated", dataset.generatedAt.toISOString()],
    ["Sources", dataset.sources.join("; ") || "—"],
  ];

  if (dataset.truncatedAt !== undefined) {
    facts.push([
      "Truncated",
      `This export was capped at ${dataset.truncatedAt} rows. Narrow the search or upgrade for bulk export.`,
    ]);
  }

  facts.push(["Licence", attributionLine(dataset)]);
  facts.push([
    "Accuracy",
    "Records are reproduced as published. Always check the source URL before acting on a record.",
  ]);

  for (const [label, value] of facts) {
    const row = about.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
