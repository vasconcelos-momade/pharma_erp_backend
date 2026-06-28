import { type ReportDefinition, type ReportPageOrientation, type ReportPageSize } from "../types/report.types";
import { renderInstitutionalReportTextLines } from "./institutional-report.template";

function toAscii(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildSimplePdfFromLines(lines: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const safeLines = lines.map((line) => escapePdfText(toAscii(line)));
  const streamLines = ["BT", "/F1 10 Tf", "40 800 Td"];

  for (const line of safeLines) {
    streamLines.push(`(${line}) Tj`);
    streamLines.push("0 -13 Td");
  }

  streamLines.push("ET");
  const stream = `${streamLines.join("\n")}\n`;
  const streamBytes = encoder.encode(stream);
  const streamLength = streamBytes.length;

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
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

function resolvePdfFormat(definition: ReportDefinition): {
  format: ReportPageSize;
  landscape: boolean;
} {
  const orientation =
    definition.pdf?.orientation ?? definition.orientation ?? "portrait";
  const pageSize = definition.pdf?.pageSize ?? definition.pageSize ?? "A4";

  return {
    format: pageSize,
    landscape: orientation === "landscape",
  };
}

export async function convertHtmlToPdf(
  html: string,
  definition: ReportDefinition,
): Promise<Uint8Array> {
  try {
    const puppeteer = await import("puppeteer");
    const { format, landscape } = resolvePdfFormat(definition);
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({
        format,
        landscape,
        printBackground: true,
        margin: {
          top: "12mm",
          right: "10mm",
          bottom: "14mm",
          left: "10mm",
        },
      });
      return new Uint8Array(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch {
    return buildSimplePdfFromLines(renderInstitutionalReportTextLines(definition));
  }
}
