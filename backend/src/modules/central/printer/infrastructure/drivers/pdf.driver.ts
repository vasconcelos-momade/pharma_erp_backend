import type {
  PrintDriverJob,
  PrintDriverResult,
  PrintDriverTarget,
  PrinterDriver,
} from "../../domain/drivers/printer-driver";
import { buildPrintPdfBytes } from "./pdf-document.builder";

/**
 * Driver PDF para Flutter Web (preview / download).
 * Reutiliza o gerador simples já usado em billing/reports.
 */
export class PdfDriver implements PrinterDriver {
  readonly name = "PdfDriver";

  supports(target: PrintDriverTarget): boolean {
    return (
      target.connection.toUpperCase() === "PDF" ||
      target.type.toUpperCase() === "A4"
    );
  }

  async print(
    target: PrintDriverTarget,
    job: PrintDriverJob,
  ): Promise<PrintDriverResult> {
    try {
      const bytes = buildPrintPdfBytes(job.document, job.payload, target.name);
      return {
        success: true,
        bytesSent: bytes.byteLength,
        output: bytes,
        mimeType: "application/pdf",
      };
    } catch (error: unknown) {
      return {
        success: false,
        errorMessage:
          error instanceof Error ? error.message : "Falha ao gerar PDF",
      };
    }
  }
}
