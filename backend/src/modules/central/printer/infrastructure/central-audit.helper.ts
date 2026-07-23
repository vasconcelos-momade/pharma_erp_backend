import { prismaCentralUnscoped } from "../../../../infrastructure/prisma/prisma-central.service";

type CentralAuditInput = {
  tenantId?: bigint | null;
  branchId?: bigint | null;
  userId?: bigint | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldData?: unknown;
  newData?: unknown;
  data?: unknown;
};

/**
 * Auditoria no Central AuditLog (append-only).
 * Não usar ComplianceAuditService (esse é do tenant DB).
 */
export async function writeCentralAuditLog(
  input: CentralAuditInput,
  tx: any = prismaCentralUnscoped,
) {
  await tx.auditLog.create({
    data: {
      tenantId: input.tenantId ?? null,
      branchId: input.branchId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      oldData: input.oldData ?? undefined,
      newData: input.newData ?? undefined,
      data: input.data ?? undefined,
    },
  });
}
