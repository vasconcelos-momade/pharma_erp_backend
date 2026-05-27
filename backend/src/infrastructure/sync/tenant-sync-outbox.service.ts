import { getBranchStore } from "../../shared/context/branch-context";
import { runWithCentralTenant } from "../../shared/context/central-tenant-context";
import { prismaCentral } from "../prisma/prisma-central.service";
import { enqueueSyncLogDeduped } from "./sync-log-dedup.service";

type SyncOperationValue = "CREATE" | "UPDATE" | "DELETE";

type BusinessEventTx = {
  businessEvent: {
    create(args: {
      data: {
        userId: bigint;
        type: string;
        entity: string;
        entityId?: bigint | null;
        payload?: unknown;
      };
    }): Promise<unknown>;
  };
};

export interface LocalOutboxEventInput {
  userId: bigint;
  type: string;
  entity: string;
  entityId?: bigint | null;
  payload?: unknown;
}

export interface MirrorToCentralInput {
  entity: string;
  entityId: bigint | string;
  operation: SyncOperationValue;
  payload?: unknown;
  schemaVersion?: number;
}

export async function recordLocalOutboxEvent(
  tx: BusinessEventTx,
  input: LocalOutboxEventInput,
): Promise<void> {
  await tx.businessEvent.create({
    data: {
      userId: input.userId,
      type: input.type,
      entity: input.entity,
      entityId: input.entityId ?? null,
      payload: input.payload,
    },
  });
}

/**
 * Espelha para o plano central de sync sem assumir transação distribuída.
 * Se o central falhar, o evento local continua gravado no DB da branch.
 */
export async function mirrorToCentralSync(input: MirrorToCentralInput): Promise<void> {
  const store = getBranchStore();
  const tenantId = BigInt(store.tenantId);
  const branchId = BigInt(store.branchId);

  try {
    await runWithCentralTenant(store.tenantId, async () => {
      await enqueueSyncLogDeduped(prismaCentral as any, {
        tenantId,
        branchId,
        entity: input.entity,
        entityId: String(input.entityId),
        operation: input.operation,
        payload: input.payload,
        schemaVersion: input.schemaVersion ?? 1,
      });
    });
  } catch (error) {
    console.error("[sync-outbox] falha ao espelhar evento local para o central:", error);
  }
}
