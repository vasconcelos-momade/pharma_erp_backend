import { PrintJobRepository } from "../../infrastructure/repositories/print-job.repository";
import { PrinterRepository } from "../../infrastructure/repositories/printer.repository";
import { writeCentralAuditLog } from "../../infrastructure/central-audit.helper";
import type { TestPrinterDTO } from "../dto/printer.dto";
import { enqueuePrintProcessJob } from "./drain-print-jobs.use-case";

/**
 * Enfileira um PrintJob de teste (documento TEST).
 * A execução ESC/POS/PDF é feita pelo print-job.worker.
 */
export class TestPrinterUseCase {
  constructor(
    private readonly printers = new PrinterRepository(),
    private readonly jobs = new PrintJobRepository(),
  ) {}

  async execute(input: {
    tenantId: string;
    printerId: string;
    userId?: string | null;
    data?: TestPrinterDTO;
  }) {
    const printer = await this.printers.findById(
      BigInt(input.printerId),
      BigInt(input.tenantId),
    );
    if (!printer) throw new Error("Impressora não encontrada");
    if (!printer.active) throw new Error("Impressora inactiva");

    const message =
      input.data?.message?.trim() ||
      `Teste Skalway Health — ${printer.name} — ${new Date().toISOString()}`;

    const job = await this.jobs.create(
      {
        tenantId: BigInt(input.tenantId),
        branchId: BigInt(printer.branchId),
        printerId: BigInt(input.printerId),
        document: "TEST",
        payload: {
          kind: "TEST",
          message,
          platform: input.data?.platform,
          printer: {
            id: printer.id,
            name: printer.name,
            type: printer.type,
            connection: printer.connection,
            ip: printer.ip,
            port: printer.port,
          },
          requestedAt: new Date().toISOString(),
        },
        maxAttempts: 2,
      },
      input.userId ? BigInt(input.userId) : null,
    );

    await writeCentralAuditLog({
      tenantId: BigInt(input.tenantId),
      branchId: BigInt(printer.branchId),
      userId: input.userId ? BigInt(input.userId) : null,
      action: "TEST",
      entity: "Printer",
      entityId: printer.id,
      data: { printJobId: job.id, message },
    });

    await enqueuePrintProcessJob({
      printJobId: job.id,
      tenantId: input.tenantId,
    });

    return {
      printer,
      job,
      message: "Trabalho de teste enfileirado",
    };
  }
}
