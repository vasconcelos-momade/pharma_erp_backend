import { PrintJobRepository } from "../../infrastructure/repositories/print-job.repository";
import type { ListPrintJobsQueryDTO } from "../dto/printer.dto";

export class ListPrintJobsUseCase {
  constructor(private readonly jobs = new PrintJobRepository()) {}

  async execute(input: {
    tenantId: string;
    branchId?: string | null;
    query: ListPrintJobsQueryDTO;
  }) {
    const branchId = input.query.branchId ?? input.branchId ?? undefined;

    return this.jobs.list({
      tenantId: BigInt(input.tenantId),
      branchId: branchId ? BigInt(branchId) : undefined,
      printerId: input.query.printerId
        ? BigInt(input.query.printerId)
        : undefined,
      status: input.query.status,
      document: input.query.document,
      page: input.query.page,
      pageSize: input.query.pageSize,
    });
  }
}
