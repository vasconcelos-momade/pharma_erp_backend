import { PrintJobRepository } from "../../infrastructure/repositories/print-job.repository";

export class GetPrintJobUseCase {
  constructor(private readonly jobs = new PrintJobRepository()) {}

  async execute(input: { tenantId: string; jobId: string }) {
    const job = await this.jobs.findById(
      BigInt(input.jobId),
      BigInt(input.tenantId),
    );
    if (!job) throw new Error("PrintJob não encontrado");
    return job;
  }
}
