import type { Prisma, SyncOperation } from "../prisma/central/generated/central";
import { hashSyncPayload } from "../../shared/utils/sync-payload-hash";

const ACTIVE_SYNC_STATUSES = ["PENDING", "PROCESSING"] as const;

type SyncLogDb = {
  $transaction<T>(fn: (tx: SyncLogTx) => Promise<T>): Promise<T>;
  syncLog: SyncLogTx["syncLog"];
};

type SyncLogTx = {
  syncLog: {
    findFirst(args: {
      where: {
        tenantId: bigint;
        payloadHash: string;
        deletedAt: null;
        status: { in: readonly string[] };
      };
      select: { id: true };
    }): Promise<{ id: bigint } | null>;
    create(args: {
      data: Prisma.SyncLogCreateInput;
    }): Promise<{ id: bigint }>;
  };
};

export interface EnqueueSyncLogInput {
  tenantId: bigint;
  branchId: bigint;
  deviceId?: bigint;
  entity: string;
  entityId: string;
  operation: SyncOperation;
  payload?: unknown;
  schemaVersion?: number;
}

/**
 * Único ponto de criação de SyncLog.
 * Se payloadHash já existir em PENDING ou PROCESSING para o tenant → não cria novo.
 */
export async function enqueueSyncLogDeduped(
  db: SyncLogDb,
  input: EnqueueSyncLogInput,
): Promise<{ id: bigint; deduplicated: boolean }> {
  const payloadHash = hashSyncPayload(input.payload);

  return db.$transaction(async (tx) => {
    const existing = await findActiveByPayloadHash(tx, input.tenantId, payloadHash);
    if (existing) {
      return { id: existing.id, deduplicated: true };
    }

    try {
      const created = await tx.syncLog.create({
        data: {
          tenant: { connect: { id: input.tenantId } },
          branch: { connect: { id: input.branchId } },
          ...(input.deviceId != null
            ? { device: { connect: { id: input.deviceId } } }
            : {}),
          entity: input.entity,
          entityId: input.entityId,
          operation: input.operation,
          payload: input.payload as Prisma.InputJsonValue | undefined,
          payloadHash,
          schemaVersion: input.schemaVersion ?? 1,
        },
      });
      return { id: created.id, deduplicated: false };
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        const dup = await findActiveByPayloadHash(tx, input.tenantId, payloadHash);
        if (dup) {
          return { id: dup.id, deduplicated: true };
        }
      }
      throw error;
    }
  });
}

async function findActiveByPayloadHash(
  tx: SyncLogTx,
  tenantId: bigint,
  payloadHash: string,
): Promise<{ id: bigint } | null> {
  return tx.syncLog.findFirst({
    where: {
      tenantId,
      payloadHash,
      deletedAt: null,
      status: { in: [...ACTIVE_SYNC_STATUSES] },
    },
    select: { id: true },
  });
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}
