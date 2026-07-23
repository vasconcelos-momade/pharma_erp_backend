import { buildSimplePdfFromLines } from "../../../../tenant/reports/application/templates/pdf-html.converter";

function asRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : {};
}

export function buildPrintPdfLines(
  document: string,
  payload: unknown,
  printerName?: string,
): string[] {
  const data = asRecord(payload);
  const lines: string[] = [
    "Skalway Health",
    printerName ? `Impressora: ${printerName}` : "",
    `Documento: ${document}`,
    `Gerado em: ${new Date().toLocaleString("pt-MZ")}`,
    "--------------------------------",
  ].filter(Boolean);

  if (document === "TEST" || data.kind === "TEST") {
    lines.push(
      "TESTE DE IMPRESSAO (PDF)",
      String(data.message ?? "Impressora OK"),
      "",
      "Este PDF substitui ESC/POS no Flutter Web.",
    );
    return lines;
  }

  if (data.title) lines.push(String(data.title), "");

  if (Array.isArray(data.lines)) {
    for (const line of data.lines) lines.push(String(line));
  } else if (data.message || data.body) {
    lines.push(String(data.message ?? data.body));
  }

  if (data.footer) {
    lines.push("", "--------------------------------", String(data.footer));
  }

  return lines;
}

export function buildPrintPdfBytes(
  document: string,
  payload: unknown,
  printerName?: string,
): Uint8Array {
  return buildSimplePdfFromLines(
    buildPrintPdfLines(document, payload, printerName),
  );
}

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
