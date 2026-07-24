/**
 * PDF de preview do recibo térmico — largura de página = 80mm
 * (igual ao papel da impressora ESC/POS).
 *
 * 80mm ≈ 226.77 pt (1 pt = 1/72 in; 1 in = 25.4 mm)
 */

import type { FaturaReciboEscposInput } from "./fatura-recibo-escpos.template";
import { THERMAL_COLS } from "./fatura-recibo-colunas";
import { buildThermalReceiptLines } from "./fatura-recibo-layout";

export { buildThermalReceiptLines } from "./fatura-recibo-layout";

/** Largura exacta do papel térmico 80mm em pontos PDF. */
export const THERMAL_80MM_PAGE_WIDTH_PT = Math.round((80 * 72) / 25.4); // 227

/**
 * Courier PDF: largura do glifo ≈ 0.6 × fontSize.
 * 48 cols × 0.6 × 8 = 230.4 pt → ultrapassa 227 e corta à direita.
 * Com font 6.5: 48 × 0.6 × 6.5 = 187.2 pt + margens cabe em 80mm.
 */
const MARGIN_X = 6;
const MARGIN_RIGHT = 6;
const FONT_SIZE = 6.5;
const LINE_HEIGHT = 8.5;
const TITLE_SIZE = 8;

/** Máximo de caracteres que cabem na área útil com a fonte actual. */
export function maxCharsForThermalPdf(): number {
  const usable = THERMAL_80MM_PAGE_WIDTH_PT - MARGIN_X - MARGIN_RIGHT;
  const charWidth = FONT_SIZE * 0.6;
  return Math.floor(usable / charWidth);
}

function toAscii(value: unknown): string {
  // Preserva espaços múltiplos — necessários para alinhar colunas no PDF.
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdfFromLines(lines: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const pageWidth = THERMAL_80MM_PAGE_WIDTH_PT;
  const maxChars = Math.min(THERMAL_COLS.paperWidth, maxCharsForThermalPdf());
  const contentHeight = lines.length * LINE_HEIGHT + TITLE_SIZE + 24;
  const pageHeight = Math.max(200, Math.ceil(contentHeight + 16));

  const safeLines = lines.map((line) =>
    escapePdfText(toAscii(line).slice(0, maxChars)),
  );
  const startY = pageHeight - 12;

  const streamParts = [
    "BT",
    `/F1 ${TITLE_SIZE} Tf`,
    `${MARGIN_X} ${startY} Td`,
  ];

  let first = true;
  for (const line of safeLines) {
    if (first) {
      streamParts.push(`(${line}) Tj`);
      streamParts.push(`/F1 ${FONT_SIZE} Tf`);
      first = false;
    } else {
      streamParts.push(`0 -${LINE_HEIGHT} Td`);
      streamParts.push(`(${line}) Tj`);
    }
  }
  streamParts.push("ET");

  const stream = `${streamParts.join("\n")}\n`;
  const streamBytes = encoder.encode(stream);
  const streamLength = streamBytes.length;

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n",
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n",
    `5 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}endstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(encoder.encode(pdf).length);
    pdf += object;
  }

  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return encoder.encode(pdf);
}

export function gerarFaturaReciboPdf80mm(
  recibo: FaturaReciboEscposInput,
): Uint8Array {
  return buildPdfFromLines(buildThermalReceiptLines(recibo));
}
