import { describe, expect, it } from "vitest";

import { companyExportDataset } from "@/lib/export/companies";
import {
  attributionLine,
  exportFilename,
  sanitiseCell,
  toCsv,
  type ExportDataset,
} from "@/lib/export/dataset";
import { toPdf } from "@/lib/export/pdf";
import { toXlsx } from "@/lib/export/xlsx";
import type { CompanySearchRow } from "@/lib/search/companies";
import { companyFilterSchema } from "@/lib/search/types";

const GENERATED_AT = new Date("2026-09-20T09:30:00.000Z");

function row(overrides: Partial<CompanySearchRow> = {}): CompanySearchRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    companyNumber: "01234567",
    name: "Example Trading Limited",
    status: "ACTIVE",
    town: "Caerphilly",
    postcode: "CF83 1AA",
    region: "SOUTH_EAST",
    localAuthorityName: "Caerphilly",
    incorporatedOn: new Date("2015-04-01T00:00:00.000Z"),
    sicCodes: ["41201"],
    sizeBand: "SMALL",
    latitude: 51.578,
    longitude: -3.219,
    distanceKm: null,
    source: "companies_house",
    sourceUrl: "https://find-and-update.company-information.service.gov.uk/company/01234567",
    lastUpdatedAt: new Date("2026-09-19T00:00:00.000Z"),
    ...overrides,
  } as CompanySearchRow;
}

function dataset(rows: CompanySearchRow[]): ExportDataset<CompanySearchRow> {
  return companyExportDataset(rows, companyFilterSchema.parse({ q: "construction" }), {
    generatedAt: GENERATED_AT,
  });
}

describe("sanitiseCell", () => {
  it("passes ordinary values through unchanged", () => {
    expect(sanitiseCell("Example Trading Limited")).toBe("Example Trading Limited");
    expect(sanitiseCell(42)).toBe("42");
  });

  it("renders a missing value as an empty cell rather than inventing one", () => {
    expect(sanitiseCell(null)).toBe("");
  });

  it("neutralises values a spreadsheet would evaluate as a formula", () => {
    expect(sanitiseCell("=1+1")).toBe("'=1+1");
    expect(sanitiseCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(sanitiseCell("-Dyfed Ltd")).toBe("'-Dyfed Ltd");
    expect(sanitiseCell("+44 1234")).toBe("'+44 1234");
  });
});

describe("toCsv", () => {
  it("writes machine-readable headers followed by one line per row", () => {
    const csv = toCsv(dataset([row(), row({ companyNumber: "07654321" })]));
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('"company_number"');
    expect(lines[1]).toContain('"01234567"');
    expect(lines[2]).toContain('"07654321"');
  });

  it("escapes embedded quotes", () => {
    const csv = toCsv(dataset([row({ name: 'The "Big" Company Ltd' })]));
    expect(csv).toContain('"The ""Big"" Company Ltd"');
  });

  it("always carries the source and source URL", () => {
    const csv = toCsv(dataset([row()]));
    expect(csv).toContain("companies_house");
    expect(csv).toContain("find-and-update.company-information.service.gov.uk");
  });

  it("writes an empty cell for a missing value", () => {
    const csv = toCsv(dataset([row({ postcode: null, incorporatedOn: null })]));
    expect(csv.split("\r\n")[1]).toContain('""');
  });
});

describe("attributionLine", () => {
  it("names the sources and the licence", () => {
    const line = attributionLine(dataset([row()]));
    expect(line).toContain("Companies House");
    expect(line).toContain("Open Government Licence v3.0");
    expect(line).toContain("2026-09-20");
  });
});

describe("exportFilename", () => {
  it("stamps the generation date and the extension", () => {
    expect(exportFilename(dataset([]), "xlsx")).toBe(
      "cymru-intelligence-companies-2026-09-20.xlsx"
    );
  });
});

describe("toXlsx", () => {
  it("produces a valid xlsx file", async () => {
    const buffer = await toXlsx(dataset([row(), row({ companyNumber: "07654321" })]));
    // An xlsx is a zip: it must start with the local file header signature.
    expect(buffer.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it("includes both the data sheet and the provenance sheet", async () => {
    const buffer = await toXlsx(dataset([row()]));
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Data",
      "About this export",
    ]);

    const data = workbook.getWorksheet("Data")!;
    expect(data.getRow(1).getCell(1).value).toBe("Company no.");
    expect(data.getRow(2).getCell(2).value).toBe("Example Trading Limited");

    const about = workbook.getWorksheet("About this export")!;
    const text = about
      .getColumn(2)
      .values.filter((value) => typeof value === "string")
      .join(" ");
    expect(text).toContain("Open Government Licence");
    expect(text).toContain("construction");
  });

  it("keeps numeric columns numeric so a spreadsheet can total them", async () => {
    const buffer = await toXlsx(dataset([row()]));
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const latitude = workbook.getWorksheet("Data")!.getRow(2).getCell(11).value;
    expect(typeof latitude).toBe("number");
    expect(latitude).toBeCloseTo(51.578, 3);
  });
});

describe("company export columns", () => {
  it("keeps every column in the machine-readable formats", () => {
    const columns = dataset([]).columns;
    expect(columns.map((column) => column.key)).toContain("latitude");
    expect(columns.map((column) => column.key)).toContain("region");
  });

  it("marks the columns a landscape page has no room for", () => {
    const omitted = dataset([])
      .columns.filter((column) => column.omitFromPdf)
      .map((column) => column.key);
    expect(omitted).toEqual(["region", "size_band", "latitude", "longitude", "source"]);
  });

  it("always keeps the source URL in every format", () => {
    const sourceUrl = dataset([]).columns.find((column) => column.key === "source_url");
    expect(sourceUrl?.omitFromPdf).toBeUndefined();
  });

  it("prints a short date but exports the full timestamp", () => {
    const column = dataset([]).columns.find((column) => column.key === "last_updated_at")!;
    const sample = row();
    expect(column.value(sample)).toBe("2026-09-19T00:00:00.000Z");
    expect(column.display!(sample)).toBe("2026-09-19");
  });
});

describe("toPdf", () => {
  it("produces a valid PDF", async () => {
    const bytes = await toPdf(dataset([row()]));
    expect(Buffer.from(bytes.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
  });

  it("paginates a long table instead of overflowing one page", async () => {
    const many = Array.from({ length: 120 }, (_, index) =>
      row({ companyNumber: String(index).padStart(8, "0") })
    );
    const bytes = await toPdf(dataset(many));

    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it("renders Welsh characters the standard fonts cannot encode", async () => {
    // Helvetica is WinAnsi-encoded and pdf-lib throws on ŵ; the export must
    // transliterate rather than fail.
    await expect(
      toPdf(dataset([row({ name: "Llŷn Adeiladwyr Cyf", town: "Pwllheli" })]))
    ).resolves.toBeInstanceOf(Uint8Array);
  });

  it("prints a negative coordinate as a number, not a guarded string", () => {
    // sanitiseCell guards strings that begin with "-"; a longitude is a value,
    // not a formula, so the guard must not reach it.
    expect(sanitiseCell(-3.219)).toBe("-3.219");
  });

  it("carries the export title into the document metadata", async () => {
    const bytes = await toPdf(dataset([row()]));
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe("Welsh companies");
  });
});
