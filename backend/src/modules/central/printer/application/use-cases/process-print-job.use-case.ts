import { PrintJobRepository } from "../../infrastructure/repositories/print-job.repository";
import { PrinterDriverRegistry } from "../services/printer-driver.registry";
import { toBase64 } from "../../infrastructure/drivers/pdf-document.builder";

function wantsPdf(payload: unknown, connection: string, type: string): boolean {
  const data =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const platform = String(data.platform ?? "").toLowerCase();
  if (platform === "web") return true;
  if (data.forcePdf === true) return true;
  return (
    connection.toUpperCase() === "PDF" || type.toUpperCase() === "A4"
  );
}

/**
 * Executa um PrintJob já reservado (PROCESSING) via PrinterDriver.
 */
export class ProcessPrintJobUseCase {
  constructor(
    private readonly jobs = new PrintJobRepository(),
    private readonly drivers = new PrinterDriverRegistry(),
  ) {}

  async execute(input: {
    jobId: string;
    tenantId: string;
    workerId?: string;
  }) {
    const job = await this.jobs.findById(
      BigInt(input.jobId),
      BigInt(input.tenantId),
    );
    if (!job) throw new Error("PrintJob não encontrado");
    if (!job.printer) throw new Error("PrintJob sem impressora associada");

    if (job.status === "PRINTED" || job.status === "CANCELLED") {
      return { job, skipped: true as const, reason: job.status };
    }

    const target = {
      printerId: job.printer.id,
      name: job.printer.name,
      type: job.printer.type,
      connection: job.printer.connection,
      ip: job.printer.ip,
      port: job.printer.port,
    };

    const forcePdf = wantsPdf(
      job.payload,
      job.printer.connection,
      job.printer.type,
    );

    const result = await this.drivers.print(
      target,
      {
        jobId: job.id,
        document: job.document,
        payload: job.payload,
      },
      { forcePdf },
    );

    if (result.success) {
      const artifact =
        result.output && result.mimeType
          ? {
              mimeType: result.mimeType,
              base64: toBase64(result.output),
              driver: result.driver,
              bytesSent: result.bytesSent,
            }
          : undefined;

      const updated = await this.jobs.markPrinted(
        BigInt(job.id),
        BigInt(input.tenantId),
        input.workerId,
        artifact,
      );
      return {
        job: updated,
        skipped: false as const,
        result,
      };
    }

    const updated = await this.jobs.markFailed(
      BigInt(job.id),
      BigInt(input.tenantId),
      result.errorMessage ?? "Falha na impressão",
      { retry: true, workerId: input.workerId },
    );

    return {
      job: updated,
      skipped: false as const,
      result,
    };
  }
}
