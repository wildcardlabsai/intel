import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { attributionLine, type ExportDataset } from "@/lib/export/dataset";

/**
 * PDF export.
 *
 * Built with pdf-lib and the standard Helvetica faces, so nothing has to be
 * read from disk at runtime — which matters on a serverless host where font
 * files are not reliably bundled.
 *
 * Layout is done explicitly rather than by a table library: columns are sized
 * from their declared widths, cells are truncated to fit with an ellipsis
 * rather than overflowing, and every page carries the source attribution the
 * Open Government Licence requires.
 */

const A4_LANDSCAPE = { width: 841.89, height: 595.28 };
const MARGIN = 36;
/** Title block, plus a line for the omitted-column or truncation note. */
const HEADER_HEIGHT = 80;
const HEADER_HEIGHT_WITH_NOTE = 94;
/** Clears the attribution rule at MARGIN + 18 with room to spare. */
const FOOTER_HEIGHT = 62;
const ROW_HEIGHT = 16;
const BODY_SIZE = 8;
const HEADER_SIZE = 8;

const INK = rgb(0.063, 0.133, 0.118);
const MUTED = rgb(0.4, 0.451, 0.427);
const BRAND = rgb(0.063, 0.165, 0.137);
const STRIPE = rgb(0.957, 0.953, 0.925);

/** Cuts text to fit a column, ending with an ellipsis when it had to be cut. */
function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;

  const ellipsis = "…";
  const ellipsisWidth = font.widthOfTextAtSize(ellipsis, size);
  let result = "";
  for (const char of text) {
    if (font.widthOfTextAtSize(result + char, size) + ellipsisWidth > maxWidth) break;
    result += char;
  }
  return result + ellipsis;
}

/**
 * Replaces characters the standard PDF fonts cannot encode.
 *
 * Helvetica is WinAnsi-encoded; pdf-lib throws on anything outside it, and a
 * Welsh place name containing ŵ or ŷ would otherwise fail the whole export.
 */
function toWinAnsi(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[ŴŶ]/g, (char) => (char === "Ŵ" ? "W" : "Y"))
    .replace(/[ŵŷ]/g, (char) => (char === "ŵ" ? "w" : "y"))
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–/g, "-")
    .replace(/—/g, "—")
    // Anything still outside Latin-1 plus the few punctuation marks above is
    // dropped rather than risking an encoding error mid-export.
    .replace(/[^ -~ -ÿ…—]/g, "");
}

export async function toPdf<T>(dataset: ExportDataset<T>): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(dataset.title);
  pdf.setProducer("Cymru Intelligence");
  pdf.setCreationDate(dataset.generatedAt);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const columns = dataset.columns.filter((column) => !column.omitFromPdf);
  const omittedCount = dataset.columns.length - columns.length;

  const notes: string[] = [];
  if (dataset.truncatedAt !== undefined) {
    notes.push(
      `Capped at ${dataset.truncatedAt} rows — narrow the search for a complete export.`
    );
  }
  if (omittedCount > 0) {
    notes.push(
      `${omittedCount} further ${omittedCount === 1 ? "column is" : "columns are"} included in the CSV and spreadsheet exports.`
    );
  }
  const note = notes.join(" ");
  const headerHeight = note ? HEADER_HEIGHT_WITH_NOTE : HEADER_HEIGHT;

  const usableWidth = A4_LANDSCAPE.width - MARGIN * 2;
  const totalWeight = columns.reduce((sum, column) => sum + (column.width ?? 18), 0);
  const columnWidths = columns.map(
    (column) => ((column.width ?? 18) / totalWeight) * usableWidth
  );

  const rowsPerPage = Math.max(
    1,
    Math.floor((A4_LANDSCAPE.height - headerHeight - FOOTER_HEIGHT - ROW_HEIGHT) / ROW_HEIGHT)
  );
  const pageCount = Math.max(1, Math.ceil(dataset.rows.length / rowsPerPage));
  const attribution = toWinAnsi(attributionLine(dataset));

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = pdf.addPage([A4_LANDSCAPE.width, A4_LANDSCAPE.height]);
    drawHeader(page, dataset, bold, regular, pageIndex === 0, note);

    let y = A4_LANDSCAPE.height - headerHeight;

    // Column headings.
    page.drawRectangle({
      x: MARGIN,
      y: y - ROW_HEIGHT + 4,
      width: usableWidth,
      height: ROW_HEIGHT,
      color: BRAND,
    });

    let x = MARGIN;
    columns.forEach((column, index) => {
      page.drawText(fit(toWinAnsi(column.header), bold, HEADER_SIZE, columnWidths[index]! - 8), {
        x: x + 4,
        y: y - ROW_HEIGHT + 9,
        size: HEADER_SIZE,
        font: bold,
        color: rgb(0.957, 0.953, 0.925),
      });
      x += columnWidths[index]!;
    });

    y -= ROW_HEIGHT;

    const pageRows = dataset.rows.slice(
      pageIndex * rowsPerPage,
      pageIndex * rowsPerPage + rowsPerPage
    );

    pageRows.forEach((row, rowIndex) => {
      if (rowIndex % 2 === 1) {
        page.drawRectangle({
          x: MARGIN,
          y: y - ROW_HEIGHT + 4,
          width: usableWidth,
          height: ROW_HEIGHT,
          color: STRIPE,
        });
      }

      let cellX = MARGIN;
      columns.forEach((column, index) => {
        const value = column.display ? column.display(row) : column.value(row);
        const raw = toWinAnsi(value === null ? "" : String(value));
        const width = columnWidths[index]! - 8;
        const text = fit(raw, regular, BODY_SIZE, width);
        const offset =
          column.align === "right"
            ? width - regular.widthOfTextAtSize(text, BODY_SIZE)
            : 0;

        page.drawText(text, {
          x: cellX + 4 + offset,
          y: y - ROW_HEIGHT + 9,
          size: BODY_SIZE,
          font: regular,
          color: INK,
        });
        cellX += columnWidths[index]!;
      });

      y -= ROW_HEIGHT;
    });

    drawFooter(page, regular, attribution, pageIndex + 1, pageCount);
  }

  return pdf.save();
}

function drawHeader<T>(
  page: PDFPage,
  dataset: ExportDataset<T>,
  bold: PDFFont,
  regular: PDFFont,
  isFirstPage: boolean,
  note: string
): void {
  const top = A4_LANDSCAPE.height - MARGIN;

  page.drawText(toWinAnsi(dataset.title), {
    x: MARGIN,
    y: top - 10,
    size: 14,
    font: bold,
    color: INK,
  });

  const subtitle = isFirstPage
    ? `${dataset.criteria} — ${dataset.rows.length} ${dataset.rows.length === 1 ? "record" : "records"}`
    : dataset.criteria;

  page.drawText(fit(toWinAnsi(subtitle), regular, 8, A4_LANDSCAPE.width - MARGIN * 2 - 160), {
    x: MARGIN,
    y: top - 24,
    size: 8,
    font: regular,
    color: MUTED,
  });

  if (note) {
    page.drawText(fit(toWinAnsi(note), regular, 8, A4_LANDSCAPE.width - MARGIN * 2), {
      x: MARGIN,
      y: top - 38,
      size: 8,
      font: regular,
      color: MUTED,
    });
  }

  const stamp = toWinAnsi(`Generated ${dataset.generatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC`);
  page.drawText(stamp, {
    x: A4_LANDSCAPE.width - MARGIN - regular.widthOfTextAtSize(stamp, 8),
    y: top - 10,
    size: 8,
    font: regular,
    color: MUTED,
  });
}

function drawFooter(
  page: PDFPage,
  regular: PDFFont,
  attribution: string,
  pageNumber: number,
  pageCount: number
): void {
  const usableWidth = A4_LANDSCAPE.width - MARGIN * 2;

  page.drawLine({
    start: { x: MARGIN, y: MARGIN + 18 },
    end: { x: A4_LANDSCAPE.width - MARGIN, y: MARGIN + 18 },
    thickness: 0.5,
    color: rgb(0.851, 0.867, 0.835),
  });

  page.drawText(fit(attribution, regular, 7, usableWidth - 60), {
    x: MARGIN,
    y: MARGIN + 6,
    size: 7,
    font: regular,
    color: MUTED,
  });

  const label = `Page ${pageNumber} of ${pageCount}`;
  page.drawText(label, {
    x: A4_LANDSCAPE.width - MARGIN - regular.widthOfTextAtSize(label, 7),
    y: MARGIN + 6,
    size: 7,
    font: regular,
    color: MUTED,
  });
}
