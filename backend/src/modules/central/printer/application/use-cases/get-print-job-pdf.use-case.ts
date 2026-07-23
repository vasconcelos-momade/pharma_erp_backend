import { PrintJobRepository } from "../../infrastructure/repositories/print-job.repository";
import {
  buildPrintPdfBytes,
  toBase64,
} from "../../infrastructure/drivers/pdf-document.builder";

/**
 * Devolve PDF de um PrintJob (artefacto guardado ou regenerado).
 * Usado pelo Flutter Web para preview/download.
 */
export class GetPrintJobPdfUseCase {
  constructor(private readonly jobs = new PrintJobRepository()) {}

  async execute(input: { tenantId: string; jobId: string }) {
    const job = await this.jobs.findById(
      BigInt(input.jobId),
      BigInt(input.tenantId),
    );
    if (!job) throw new Error("PrintJob não encontrado");

    const payload =
      job.payload && typeof job.payload === "object"
        ? (job.payload as Record<string, unknown>)
        : {};
    const stored = payload._result as
      | { mimeType?: string; base64?: string; driver?: string }
      | undefined;

    if (stored?.base64 && stored.mimeType === "application/pdf") {
      const bytes = Buffer.from(stored.base64, "base64");
      return {
        jobId: job.id,
        document: job.document,
        fileName: `print-job-${job.id}.pdf`,
        contentType: "application/pdf",
        bytes: new Uint8Array(bytes),
        base64: stored.base64,
        regenerated: false,
        driver: stored.driver ?? "PdfDriver",
      };
    }

    const bytes = buildPrintPdfBytes(
      job.document,
      job.payload,
      job.printer?.name,
    );

    return {
      jobId: job.id,
      document: job.document,
      fileName: `print-job-${job.id}.pdf`,
      contentType: "application/pdf",
      bytes,
      base64: toBase64(bytes),
      regenerated: true,
      driver: "PdfDriver",
    };
  }
}
