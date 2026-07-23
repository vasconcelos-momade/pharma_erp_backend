import { PrismaClient } from "./central/generated/central";
import {
  getCentralTenantId,
  isTenantScopeBypassed,
} from "../../shared/context/central-tenant-context";

/**
 * Opção A — Prisma Extension global (fora do schema, em runtime).
 * Com TENANT_SCOPE_STRICT=true (default), queries em modelos com tenantId
 * sem contexto activo falham em vez de vazar dados.
 */
export const TENANT_SCOPED_MODELS = new Set<string>([
  "UserTenant",
  "TenantSetting",
  "Branch",
  "Device",
  "Printer",
  "PrintJob",
  "SyncLog",
  "SyncTombstone",
  "SyncSession",
  "SyncConflict",
  "Subscription",
  "BillingSnapshot",
  "Invoice",
  "InvoiceFiscalCounter",
  "Payment",
  "PaymentWebhook",
  "TenantWallet",
  "WalletTransaction",
  "AuditLog",
  "JobQueue",
]);

const READ_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

const WRITE_FILTER_OPS = new Set([
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

function isStrictMode(): boolean {
  return process.env.TENANT_SCOPE_STRICT !== "false";
}

function injectTenantWhere(
  where: Record<string, unknown> | undefined,
  tenantId: bigint,
): Record<string, unknown> {
  return { ...(where ?? {}), tenantId };
}

function injectTenantCreateData(
  data: Record<string, unknown>,
  tenantId: bigint,
): Record<string, unknown> {
  if (data.tenantId !== undefined && BigInt(String(data.tenantId)) !== tenantId) {
    throw new Error(
      "Tenant scope violation: tenantId no create não corresponde ao contexto activo.",
    );
  }
  return { ...data, tenantId };
}

function assertTenantContext(model: string, operation: string): void {
  if (!isStrictMode() || isTenantScopeBypassed()) return;
  if (!TENANT_SCOPED_MODELS.has(model)) return;

  const tenantIdRaw = getCentralTenantId();
  if (!tenantIdRaw) {
    throw new Error(
      `[TenantScope] Operação bloqueada: ${model}.${operation} sem contexto de tenant. ` +
        `Use runWithCentralTenant(tenantId, fn) ou prismaCentralUnscoped para rotas globais.`,
    );
  }
}

export function extendWithTenantScope(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (isTenantScopeBypassed() || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          assertTenantContext(model, operation);

          const tenantIdRaw = getCentralTenantId();
          if (!tenantIdRaw) {
            return query(args);
          }

          const tenantId = BigInt(tenantIdRaw);
          const nextArgs = { ...args } as Record<string, unknown>;

          if (READ_OPS.has(operation) || WRITE_FILTER_OPS.has(operation)) {
            nextArgs.where = injectTenantWhere(
              nextArgs.where as Record<string, unknown> | undefined,
              tenantId,
            );
          }

          if (operation === "create" && nextArgs.data) {
            nextArgs.data = injectTenantCreateData(
              nextArgs.data as Record<string, unknown>,
              tenantId,
            );
          }

          if (operation === "createMany" && Array.isArray(nextArgs.data)) {
            nextArgs.data = (nextArgs.data as Record<string, unknown>[]).map(
              (row) => injectTenantCreateData(row, tenantId),
            );
          }

          if (operation === "upsert" && nextArgs.create) {
            nextArgs.create = injectTenantCreateData(
              nextArgs.create as Record<string, unknown>,
              tenantId,
            );
            if (nextArgs.where) {
              nextArgs.where = injectTenantWhere(
                nextArgs.where as Record<string, unknown>,
                tenantId,
              );
            }
          }

          return query(nextArgs as typeof args);
        },
      },
    },
  }) as unknown as PrismaClient;
}
