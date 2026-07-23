import {
  DrainPrintJobsUseCase,
  ProcessPrintJobUseCase,
} from "../../modules/central/printer";
import { PrintJobRepository } from "../../modules/central/printer/infrastructure/repositories/print-job.repository";
import {
  JobQueueService,
  type PrintProcessJobPayload,
  type QueueJob,
} from "./job-queue.service";
import { hostname } from "os";
import { randomUUID } from "crypto";

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
): unknown;

const BLOCK_TIMEOUT_SECONDS = Number(
  process.env.PRINT_QUEUE_BLOCK_TIMEOUT_SECONDS ?? 5,
);
const ERROR_RETRY_DELAY_MS = Number(
  process.env.PRINT_QUEUE_ERROR_RETRY_DELAY_MS ?? 1000,
);
const DB_POLL_EVERY_N_IDLE = Number(process.env.PRINT_DB_POLL_EVERY_IDLE ?? 3);

const WORKER_ID =
  process.env.PRINT_WORKER_ID ||
  `print-worker:${hostname()}:${randomUUID().slice(0, 8)}`;

let shuttingDown = false;
let idleCycles = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleRedisPrintJob(job: QueueJob<"print.process">) {
  const payload = job.payload as PrintProcessJobPayload;
  const repo = new PrintJobRepository();
  const processJob = new ProcessPrintJobUseCase();

  const existing = await repo.findById(
    BigInt(payload.printJobId),
    BigInt(payload.tenantId),
  );
  if (!existing) {
    console.warn("[print-worker] job inexistente:", payload.printJobId);
    return;
  }

  if (existing.status === "PENDING") {
    await repo.claimById(
      BigInt(payload.printJobId),
      BigInt(payload.tenantId),
      WORKER_ID,
    );
  }

  if (existing.status === "PRINTED" || existing.status === "CANCELLED") {
    console.log("[print-worker] job já finalizado:", existing.status);
    return;
  }

  const result = await processJob.execute({
    jobId: payload.printJobId,
    tenantId: payload.tenantId,
    workerId: WORKER_ID,
  });

  console.log("[print-worker] print.process:", {
    redisJobId: job.id,
    printJobId: payload.printJobId,
    status: result.job.status,
    skipped: result.skipped,
    driver:
      !result.skipped && "result" in result
        ? (result.result as { driver?: string }).driver
        : undefined,
  });
}

async function pollDatabaseFallback() {
  const drain = new DrainPrintJobsUseCase();
  const outcome = await drain.execute({ workerId: WORKER_ID, maxJobs: 5 });
  if (outcome.claimed > 0) {
    console.log("[print-worker] DB poll:", {
      claimed: outcome.claimed,
      results: outcome.results.map((item) => ({
        jobId: item.job.id,
        status: item.job.status,
        skipped: item.skipped,
      })),
    });
  }
}

async function main() {
  const queue = new JobQueueService(
    process.env.PRINT_QUEUE_NAME || "skalway:print-jobs",
  );
  console.log("[print-worker] iniciado", {
    workerId: WORKER_ID,
    queue: process.env.PRINT_QUEUE_NAME || "skalway:print-jobs",
  });

  while (!shuttingDown) {
    try {
      const job = await queue.dequeue(BLOCK_TIMEOUT_SECONDS);
      if (job) {
        idleCycles = 0;
        if (job.type === "print.process") {
          await handleRedisPrintJob(job as QueueJob<"print.process">);
        } else {
          console.warn(
            "[print-worker] tipo inesperado na fila de print:",
            job.type,
          );
        }
        continue;
      }

      idleCycles += 1;
      if (idleCycles >= DB_POLL_EVERY_N_IDLE) {
        idleCycles = 0;
        await pollDatabaseFallback();
      }
    } catch (error) {
      console.error("[print-worker] erro:", error);
      if (!shuttingDown) await sleep(ERROR_RETRY_DELAY_MS);
    }
  }

  console.log("[print-worker] encerrado.");
}

process.on("SIGINT", () => {
  shuttingDown = true;
});
process.on("SIGTERM", () => {
  shuttingDown = true;
});

main().catch((error) => {
  console.error("[print-worker] fatal:", error);
  process.exit(1);
});
