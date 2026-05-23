import { GenerateMonthlyBillingService } from "../../modules/central/billing/application/services/generate-monthly-billing.service";
import { RegisterTenantUseCase } from "../../modules/central/tenants/application/use-cases/register-tenant.use-case";
import {
  JobQueueService,
  type MonthlyBillingJobPayload,
  type QueueJob,
  type TenantRegisterJobPayload,
} from "./job-queue.service";

declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
  on(event: string, listener: () => void): void;
};

declare const console: {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

declare function setTimeout(
  handler: (...args: unknown[]) => void,
  timeout?: number,
  ...args: unknown[]
): unknown;

const BLOCK_TIMEOUT_SECONDS = Number(process.env.JOB_QUEUE_BLOCK_TIMEOUT_SECONDS ?? 5);
const ERROR_RETRY_DELAY_MS = Number(process.env.JOB_QUEUE_ERROR_RETRY_DELAY_MS ?? 1000);

let shuttingDown = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleTenantRegisterJob(job: QueueJob<"tenant.register">) {
  const useCase = new RegisterTenantUseCase();
  const payload = job.payload as TenantRegisterJobPayload;
  const result = await useCase.execute(payload);
  console.log("[worker] tenant.register concluido:", {
    jobId: job.id,
    tenantId: result.id,
    tenantName: result.name,
    branchId: result.branch.id,
  });
}

async function handleMonthlyBillingJob(job: QueueJob<"billing.generate-monthly">) {
  const service = new GenerateMonthlyBillingService();
  const payload = job.payload as MonthlyBillingJobPayload;
  const result = await service.execute(payload);
  console.log("[worker] billing.generate-monthly concluido:", {
    jobId: job.id,
    processed: result.processed,
    generated: result.generated,
    updated: result.updated,
    skipped: result.skipped,
  });
}

async function handleJob(job: QueueJob) {
  console.log("[worker] processando job:", {
    id: job.id,
    type: job.type,
    createdAt: job.createdAt,
  });

  switch (job.type) {
    case "tenant.register":
      await handleTenantRegisterJob(job as QueueJob<"tenant.register">);
      return;
    case "billing.generate-monthly":
      await handleMonthlyBillingJob(job as QueueJob<"billing.generate-monthly">);
      return;
    default:
      console.warn("[worker] tipo de job desconhecido, ignorando:", job);
  }
}

async function main() {
  const queue = new JobQueueService();
  console.log("[worker] iniciado. Aguardando jobs...");

  while (!shuttingDown) {
    try {
      const job = await queue.dequeue(BLOCK_TIMEOUT_SECONDS);
      if (!job) continue;
      await handleJob(job);
    } catch (error) {
      console.error("[worker] erro ao processar fila:", error);
      if (!shuttingDown) {
        await sleep(ERROR_RETRY_DELAY_MS);
      }
    }
  }

  console.log("[worker] encerrado.");
}

process.on("SIGINT", () => {
  shuttingDown = true;
});

process.on("SIGTERM", () => {
  shuttingDown = true;
});

main().catch((error) => {
  console.error("[worker] falha fatal:", error);
  process.exit(1);
});
