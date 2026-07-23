import { PrintJobRepository } from "../../infrastructure/repositories/print-job.repository";
import { JobQueueService } from "../../../../../infrastructure/queue/job-queue.service";
import { ProcessPrintJobUseCase } from "./process-print-job.use-case";

/**
 * Reserva jobs PENDING e processa via drivers (ESC/POS / PDF stub).
 * Usado pelo print-job.worker.
 */
export class DrainPrintJobsUseCase {
  constructor(
    private readonly jobs = new PrintJobRepository(),
    private readonly processJob = new ProcessPrintJobUseCase(),
  ) {}

  async execute(input: { workerId: string; maxJobs?: number }) {
    const claimed = await this.jobs.claimPendingJobs({
      workerId: input.workerId,
      maxJobs: input.maxJobs ?? 5,
    });

    const results = [];
    for (const job of claimed) {
      try {
        const outcome = await this.processJob.execute({
          jobId: job.id,
          tenantId: job.tenantId,
          workerId: input.workerId,
        });
        results.push(outcome);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Erro ao processar PrintJob";
        await this.jobs.markFailed(BigInt(job.id), BigInt(job.tenantId), message, {
          retry: true,
          workerId: input.workerId,
        });
        results.push({ job, skipped: false as const, error: message });
      }
    }

    return { claimed: claimed.length, results };
  }
}

export async function enqueuePrintProcessJob(input: {
  printJobId: string;
  tenantId: string;
}): Promise<void> {
  try {
    const queue = new JobQueueService(
      process.env.PRINT_QUEUE_NAME || "skalway:print-jobs",
    );
    await queue.enqueue("print.process", {
      printJobId: input.printJobId,
      tenantId: input.tenantId,
    });
  } catch (error) {
    // Não falhar o HTTP se Redis estiver indisponível — o worker faz poll na DB
    console.warn("[print] enqueue Redis falhou (fallback DB poll):", error);
  }
}
