import { PrintJobRepository } from "../../infrastructure/repositories/print-job.repository";
import { PrinterRepository } from "../../infrastructure/repositories/printer.repository";
import type { CreatePrintJobDTO } from "../dto/printer.dto";
import { enqueuePrintProcessJob } from "./drain-print-jobs.use-case";

export class CreatePrintJobUseCase {
  constructor(
    private readonly jobs = new PrintJobRepository(),
    private readonly printers = new PrinterRepository(),
  ) {}

  async execute(input: {
    tenantId: string;
    branchId?: string | null;
    userId?: string | null;
    data: CreatePrintJobDTO;
  }) {
    const printer = await this.printers.findById(
      BigInt(input.data.printerId),
      BigInt(input.tenantId),
    );
    if (!printer) throw new Error("Impressora não encontrada");
    if (!printer.active) throw new Error("Impressora inactiva");

    const branchId = input.data.branchId ?? input.branchId ?? printer.branchId;
    if (branchId !== printer.branchId) {
      throw new Error("A impressora não pertence à filial indicada");
    }

    const basePayload =
      input.data.payload && typeof input.data.payload === "object"
        ? (input.data.payload as Record<string, unknown>)
        : { value: input.data.payload };

    const job = await this.jobs.create(
      {
        tenantId: BigInt(input.tenantId),
        branchId: BigInt(branchId),
        printerId: BigInt(input.data.printerId),
        document: input.data.document,
        payload: {
          ...basePayload,
          ...(input.data.platform ? { platform: input.data.platform } : {}),
          ...(input.data.forcePdf != null ? { forcePdf: input.data.forcePdf } : {}),
        },
        maxAttempts: input.data.maxAttempts,
      },
      input.userId ? BigInt(input.userId) : null,
    );

    await enqueuePrintProcessJob({
      printJobId: job.id,
      tenantId: input.tenantId,
    });

    return job;
  }
}
