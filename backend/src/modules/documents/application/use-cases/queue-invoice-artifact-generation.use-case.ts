import { JobQueueService } from "../../../../infrastructure/queue/job-queue.service";

export class QueueInvoiceArtifactGenerationUseCase {
  constructor(private readonly queue = new JobQueueService()) {}

  async execute(input: {
    tenantId: string;
    branchId: string;
    faturaId: string;
    snapshotId: string;
    requestedByUserId: string;
  }) {
    return this.queue.enqueue("document.generate-invoice-artifacts", input);
  }
}
