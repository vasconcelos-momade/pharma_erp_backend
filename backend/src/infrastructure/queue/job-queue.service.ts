import { RedisClient } from "bun";
import { randomUUID } from "crypto";

export const DEFAULT_QUEUE_NAME = process.env.JOB_QUEUE_NAME || "skalway:jobs";

export interface TenantRegisterJobPayload {
  nomeEmpresa: string;
  nomeTenant: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  userId: string;
}

export interface MonthlyBillingJobPayload {
  referenceDate?: string;
  tenantId?: string;
  subscriptionId?: string;
  dueDays?: number;
  includeTrial?: boolean;
  dryRun?: boolean;
}

export type JobPayloadMap = {
  "tenant.register": TenantRegisterJobPayload;
  "billing.generate-monthly": MonthlyBillingJobPayload;
  "print.process": PrintProcessJobPayload;
};

export interface PrintProcessJobPayload {
  printJobId: string;
  tenantId: string;
}

export interface QueueJob<TType extends keyof JobPayloadMap = keyof JobPayloadMap> {
  id: string;
  type: TType;
  payload: JobPayloadMap[TType];
  createdAt: string;
}

export class JobQueueService {
  private redis: RedisClient;
  private queueName: string;

  constructor(queueName = DEFAULT_QUEUE_NAME, redisUrl = process.env.REDIS_URL) {
    this.queueName = queueName;
    this.redis = new RedisClient(redisUrl);
  }

  async enqueue<TType extends keyof JobPayloadMap>(
    type: TType,
    payload: JobPayloadMap[TType]
  ): Promise<QueueJob<TType>> {
    const job: QueueJob<TType> = {
      id: randomUUID(),
      type,
      payload,
      createdAt: new Date().toISOString(),
    };

    await this.redis.lpush(this.queueName, JSON.stringify(job));
    return job;
  }

  async dequeue(blockTimeoutSeconds = 5): Promise<QueueJob | null> {
    const result = await this.redis.brpop(this.queueName, blockTimeoutSeconds);
    if (!result) return null;

    const [, rawJob] = result;
    try {
      const parsed = JSON.parse(rawJob) as QueueJob;
      return parsed;
    } catch (error) {
      console.error("[queue] invalid job payload:", rawJob, error);
      return null;
    }
  }
}
