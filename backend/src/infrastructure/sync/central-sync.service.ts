import { prismaCentral, prismaCentralUnscoped } from "../prisma/prisma-central.service";
import { runWithCentralTenant } from "../../shared/context/central-tenant-context";
import { enqueueSyncLogDeduped } from "./sync-log-dedup.service";
import { hashSyncPayload } from "../../shared/utils/sync-payload-hash";

const DEFAULT_PULL_LIMIT = 100;
const MAX_PULL_LIMIT = 500;

type SyncOperationValue = "CREATE" | "UPDATE" | "DELETE";
type SyncSessionStatusValue = "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL";
type SyncStatusValue = "PENDING" | "PROCESSING" | "SYNCED" | "FAILED";

export interface SyncChangeInput {
  entity: string;
  entityId: string;
  operation: SyncOperationValue;
  payload?: Record<string, unknown> | null;
  schemaVersion?: number;
}

export interface SyncTombstoneInput {
  entity: string;
  entityId: string;
  deletedAt?: string;
}

export interface SyncPushInput {
  tenantId: string;
  branchId: string;
  deviceId?: string;
  changes: SyncChangeInput[];
  tombstones?: SyncTombstoneInput[];
  checksum?: string;
}

export interface SyncPullInput {
  tenantId: string;
  branchId: string;
  deviceId?: string;
  afterId?: string;
  tombstoneAfterId?: string;
  limit?: number;
}

type LatestEntityState = {
  id: bigint;
  branchId: bigint;
  operation: SyncOperationValue;
  payload: unknown;
  payloadHash: string;
};

export class SyncValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncValidationError";
  }
}

export class CentralSyncService {
  async push(input: SyncPushInput) {
    const tenantId = parseBigInt(input.tenantId, "tenantId");
    const branchId = parseBigInt(input.branchId, "branchId");
    const deviceId = input.deviceId ? parseBigInt(input.deviceId, "deviceId") : undefined;

    await this.assertBranchAndDevice(tenantId, branchId, deviceId);

    const normalizedChanges = normalizeChanges(input.changes);
    const normalizedTombstones = normalizeTombstones(input.tombstones ?? []);
    const computedChecksum = computeBatchChecksum(normalizedChanges, normalizedTombstones);

    if (input.checksum && input.checksum !== computedChecksum) {
      throw new SyncValidationError("Checksum inválido para o lote de sync.");
    }

    return runWithCentralTenant(String(tenantId), async () => {
      const session = await (prismaCentral as any).syncSession.create({
        data: {
          tenant: { connect: { id: tenantId } },
          branch: { connect: { id: branchId } },
          ...(deviceId != null ? { device: { connect: { id: deviceId } } } : {}),
          status: "RUNNING" as SyncSessionStatusValue,
        },
        select: { id: true },
      });

      let recordsPushed = 0;
      let conflictsCount = 0;

      try {
        for (const tombstone of normalizedTombstones) {
          const created = await this.ensureTombstone(tenantId, branchId, tombstone);
          if (created) recordsPushed += 1;
        }

        for (const change of normalizedChanges) {
          const payloadHash = hashSyncPayload(change.payload);
          const latestState = await this.findLatestEntityState(branchId, change.entity, change.entityId);

          if (this.shouldRegisterConflict(change, latestState, payloadHash)) {
            conflictsCount += 1;
            await (prismaCentral as any).syncConflict.create({
              data: {
                tenant: { connect: { id: tenantId } },
                branch: { connect: { id: branchId } },
                entity: change.entity,
                entityId: change.entityId,
                localPayload: (change.payload ?? null) as object | null,
                remotePayload: (latestState?.payload ?? null) as object | null,
                conflictType: "VERSION_MISMATCH",
                resolutionStrategy: "MANUAL_REVIEW",
              },
            });
            continue;
          }

          const result = await enqueueSyncLogDeduped(prismaCentral as any, {
            tenantId,
            branchId,
            deviceId,
            entity: change.entity,
            entityId: change.entityId,
            operation: change.operation,
            payload: change.payload ?? undefined,
            schemaVersion: change.schemaVersion,
          });

          if (!result.deduplicated) {
            recordsPushed += 1;
          }

          if (change.operation === "DELETE") {
            const created = await this.ensureTombstone(tenantId, branchId, {
              entity: change.entity,
              entityId: change.entityId,
            });
            if (created) recordsPushed += 1;
          }
        }

        await this.finishSession(
          session.id,
          tenantId,
          conflictsCount > 0 ? "PARTIAL" : "SUCCESS",
          {
            recordsPushed,
            conflictsCount,
            bytesSent: byteLength({
              changes: normalizedChanges,
              tombstones: normalizedTombstones,
            }),
          },
        );

        await (prismaCentralUnscoped as any).branch.updateMany({
          where: { id: branchId, tenantId },
          data: { lastSyncAt: new Date() },
        });

        return {
          sessionId: session.id.toString(),
          checksum: computedChecksum,
          accepted: recordsPushed,
          conflicts: conflictsCount,
        };
      } catch (error) {
        await this.finishSession(session.id, tenantId, "FAILED", {
          recordsPushed,
          conflictsCount,
          bytesSent: byteLength({
            changes: normalizedChanges,
            tombstones: normalizedTombstones,
          }),
          errorMessage: error instanceof Error ? error.message : "Falha no push de sync",
        });
        throw error;
      }
    });
  }

  async pull(input: SyncPullInput) {
    const tenantId = parseBigInt(input.tenantId, "tenantId");
    const branchId = parseBigInt(input.branchId, "branchId");
    const deviceId = input.deviceId ? parseBigInt(input.deviceId, "deviceId") : undefined;
    const afterId = input.afterId ? parseBigInt(input.afterId, "afterId") : 0n;
    const tombstoneAfterId = input.tombstoneAfterId
      ? parseBigInt(input.tombstoneAfterId, "tombstoneAfterId")
      : 0n;
    const limit = clampLimit(input.limit);

    await this.assertBranchAndDevice(tenantId, branchId, deviceId);

    return runWithCentralTenant(String(tenantId), async () => {
      const session = await (prismaCentral as any).syncSession.create({
        data: {
          tenant: { connect: { id: tenantId } },
          branch: { connect: { id: branchId } },
          ...(deviceId != null ? { device: { connect: { id: deviceId } } } : {}),
          status: "RUNNING" as SyncSessionStatusValue,
        },
        select: { id: true },
      });

      try {
        const changes = await (prismaCentral as any).syncLog.findMany({
          where: {
            branchId: { not: branchId },
            id: { gt: afterId },
            deletedAt: null,
            status: { in: ["PENDING", "SYNCED"] as SyncStatusValue[] },
          },
          orderBy: { id: "asc" },
          take: limit,
          select: {
            id: true,
            branchId: true,
            deviceId: true,
            entity: true,
            entityId: true,
            operation: true,
            payload: true,
            payloadHash: true,
            schemaVersion: true,
            createdAt: true,
            checksum: true,
          },
        });

        const tombstones = await (prismaCentral as any).syncTombstone.findMany({
          where: {
            branchId: { not: branchId },
            id: { gt: tombstoneAfterId },
          },
          orderBy: { id: "asc" },
          take: limit,
          select: {
            id: true,
            branchId: true,
            entity: true,
            entityId: true,
            deletedAt: true,
          },
        });

        const payload = {
          changes: changes.map((item: any) => ({
            id: item.id.toString(),
            branchId: item.branchId.toString(),
            deviceId: item.deviceId?.toString() ?? null,
            entity: item.entity,
            entityId: item.entityId,
            operation: item.operation,
            payload: item.payload,
            payloadHash: item.payloadHash,
            schemaVersion: item.schemaVersion,
            createdAt: item.createdAt.toISOString(),
            checksum: item.checksum,
          })),
          tombstones: tombstones.map((item: any) => ({
            id: item.id.toString(),
            branchId: item.branchId.toString(),
            entity: item.entity,
            entityId: item.entityId,
            deletedAt: item.deletedAt.toISOString(),
          })),
        };

        const checksum = computeBatchChecksum(payload.changes, payload.tombstones);

        await this.finishSession(session.id, tenantId, "SUCCESS", {
          recordsPulled: payload.changes.length + payload.tombstones.length,
          bytesReceived: byteLength(payload),
        });

        await (prismaCentralUnscoped as any).branch.updateMany({
          where: { id: branchId, tenantId },
          data: { lastSyncAt: new Date() },
        });

        return {
          sessionId: session.id.toString(),
          checksum,
          changes: payload.changes,
          tombstones: payload.tombstones,
          nextAfterId:
            payload.changes.length > 0 ? payload.changes[payload.changes.length - 1]!.id : input.afterId ?? null,
          nextTombstoneAfterId:
            payload.tombstones.length > 0
              ? payload.tombstones[payload.tombstones.length - 1]!.id
              : input.tombstoneAfterId ?? null,
        };
      } catch (error) {
        await this.finishSession(session.id, tenantId, "FAILED", {
          errorMessage: error instanceof Error ? error.message : "Falha no pull de sync",
        });
        throw error;
      }
    });
  }

  private async assertBranchAndDevice(tenantId: bigint, branchId: bigint, deviceId?: bigint) {
    const branch = await (prismaCentralUnscoped as any).branch.findFirst({
      where: {
        id: branchId,
        tenantId,
        active: true,
        deletedAt: null,
        syncEnabled: true,
      },
      select: { id: true },
    });

    if (!branch) {
      throw new SyncValidationError("Branch inválida ou sync desativado.");
    }

    if (deviceId == null) {
      return;
    }

    const device = await (prismaCentralUnscoped as any).device.findFirst({
      where: {
        id: deviceId,
        tenantId,
        branchId,
        active: true,
        deletedAt: null,
        trusted: true,
        revokedAt: null,
      },
      select: { id: true },
    });

    if (!device) {
      throw new SyncValidationError("Device inválido, não confiável ou revogado.");
    }
  }

  private async ensureTombstone(
    tenantId: bigint,
    branchId: bigint,
    tombstone: SyncTombstoneInput,
  ): Promise<boolean> {
    const existing = await (prismaCentral as any).syncTombstone.findFirst({
      where: {
        branchId,
        entity: tombstone.entity,
        entityId: tombstone.entityId,
      },
      select: { id: true },
    });

    if (existing) {
      return false;
    }

    await (prismaCentral as any).syncTombstone.create({
      data: {
        tenant: { connect: { id: tenantId } },
        branch: { connect: { id: branchId } },
        entity: tombstone.entity,
        entityId: tombstone.entityId,
        ...(tombstone.deletedAt ? { deletedAt: new Date(tombstone.deletedAt) } : {}),
      },
    });

    return true;
  }

  private async findLatestEntityState(
    branchId: bigint,
    entity: string,
    entityId: string,
  ): Promise<LatestEntityState | null> {
    return (prismaCentral as any).syncLog.findFirst({
      where: {
        entity,
        entityId,
        branchId: { not: branchId },
        deletedAt: null,
      },
      orderBy: { id: "desc" },
      select: {
        id: true,
        branchId: true,
        operation: true,
        payload: true,
        payloadHash: true,
      },
    });
  }

  private shouldRegisterConflict(
    change: SyncChangeInput,
    latestState: LatestEntityState | null,
    incomingPayloadHash: string,
  ): boolean {
    if (!latestState) return false;
    if (latestState.payloadHash === incomingPayloadHash) return false;

    const incomingVersion = extractVersion(change.payload);
    const latestVersion = extractVersion(latestState.payload);

    if (incomingVersion == null || latestVersion == null) {
      return false;
    }

    return incomingVersion <= latestVersion;
  }

  private async finishSession(
    sessionId: bigint,
    tenantId: bigint,
    status: SyncSessionStatusValue,
    data: {
      recordsPushed?: number;
      recordsPulled?: number;
      conflictsCount?: number;
      bytesSent?: number;
      bytesReceived?: number;
      errorMessage?: string;
    },
  ) {
    await (prismaCentralUnscoped as any).syncSession.updateMany({
      where: { id: sessionId, tenantId },
      data: {
        status,
        endedAt: new Date(),
        recordsPushed: data.recordsPushed ?? undefined,
        recordsPulled: data.recordsPulled ?? undefined,
        conflictsCount: data.conflictsCount ?? undefined,
        bytesSent: data.bytesSent != null ? BigInt(data.bytesSent) : undefined,
        bytesReceived: data.bytesReceived != null ? BigInt(data.bytesReceived) : undefined,
        errorMessage: data.errorMessage,
      },
    });
  }
}

function parseBigInt(value: string, field: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new SyncValidationError(`${field} inválido.`);
  }
}

function normalizeChanges(changes: SyncChangeInput[]): SyncChangeInput[] {
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new SyncValidationError("É obrigatório enviar pelo menos uma mudança de sync.");
  }

  return changes.map((change) => {
    if (!change?.entity || !change?.entityId || !change?.operation) {
      throw new SyncValidationError("Cada mudança precisa de entity, entityId e operation.");
    }

    return {
      entity: String(change.entity),
      entityId: String(change.entityId),
      operation: change.operation,
      payload: change.payload ?? undefined,
      schemaVersion: change.schemaVersion ?? 1,
    };
  });
}

function normalizeTombstones(tombstones: SyncTombstoneInput[]): SyncTombstoneInput[] {
  return tombstones
    .filter((item) => item?.entity && item?.entityId)
    .map((item) => ({
      entity: String(item.entity),
      entityId: String(item.entityId),
      deletedAt: item.deletedAt,
    }));
}

function extractVersion(payload: unknown): number | null {
  if (!payload || typeof payload !== "object" || !("version" in payload)) {
    return null;
  }

  const value = (payload as { version?: unknown }).version;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function computeBatchChecksum(changes: unknown, tombstones: unknown): string {
  return hashSyncPayload({ changes, tombstones });
}

function byteLength(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload ?? {}), "utf8");
}

function clampLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_PULL_LIMIT;
  return Math.max(1, Math.min(MAX_PULL_LIMIT, Number(limit)));
}
