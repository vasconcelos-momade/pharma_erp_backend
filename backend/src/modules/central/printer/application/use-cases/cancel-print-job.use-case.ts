import { PrintJobRepository } from "../../infrastructure/repositories/print-job.repository";

export class CancelPrintJobUseCase {
  constructor(private readonly jobs = new PrintJobRepository()) {}

  async execute(input: {
    tenantId: string;
    jobId: string;
    userId?: string | null;
  }) {
    return this.jobs.cancel(
      BigInt(input.jobId),
      BigInt(input.tenantId),
      input.userId ? BigInt(input.userId) : null,
    );
  }
}
