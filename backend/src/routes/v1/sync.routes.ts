import { z } from "zod";
import { CentralSyncService } from "../../infrastructure/sync/central-sync.service";
import {
  getTenantAuth,
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  requirePermission,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware, createRateLimitMiddleware } from "../../shared/http/middlewares";
import { parseJsonBody } from "../../shared/http/request-validation";
import type { RouteContext, Router } from "../../shared/http/router";

const syncChangeSchema = z.object({
  entity: z.string().trim().min(1),
  entityId: z.string().trim().min(1),
  operation: z.enum(["CREATE", "UPDATE", "DELETE"]),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  schemaVersion: z.coerce.number().int().positive().optional(),
});

const syncTombstoneSchema = z.object({
  entity: z.string().trim().min(1),
  entityId: z.string().trim().min(1),
  deletedAt: z.string().trim().min(1).optional(),
});

const syncPushSchema = z.object({
  deviceId: z.union([z.string(), z.number()]).optional().nullable(),
  changes: z.array(syncChangeSchema).default([]),
  tombstones: z.array(syncTombstoneSchema).default([]),
  checksum: z.string().trim().min(1).optional(),
});

const syncPullSchema = z.object({
  deviceId: z.union([z.string(), z.number()]).optional().nullable(),
  afterId: z.union([z.string(), z.number()]).optional().nullable(),
  tombstoneAfterId: z.union([z.string(), z.number()]).optional().nullable(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

async function pushSync(context: RouteContext): Promise<Response> {
  const auth = getTenantAuth(context);
  const body = await parseJsonBody(context.req, syncPushSchema);
  const service = new CentralSyncService();
  const result = await service.push({
    tenantId: auth.tenantId,
    branchId: auth.branchId,
    deviceId: body.deviceId != null ? String(body.deviceId) : undefined,
    changes: body.changes,
    tombstones: body.tombstones,
    checksum: body.checksum,
  });

  return Response.json(result, { status: 202 });
}

async function pullSync(context: RouteContext): Promise<Response> {
  const auth = getTenantAuth(context);
  const body = await parseJsonBody(context.req, syncPullSchema);
  const service = new CentralSyncService();
  const result = await service.pull({
    tenantId: auth.tenantId,
    branchId: auth.branchId,
    deviceId: body.deviceId != null ? String(body.deviceId) : undefined,
    afterId: body.afterId != null ? String(body.afterId) : undefined,
    tombstoneAfterId: body.tombstoneAfterId != null ? String(body.tombstoneAfterId) : undefined,
    limit: body.limit,
  });

  return Response.json(result);
}

function registerSyncPath(
  router: Router,
  path: string,
  permission: readonly ["CONFIGURACOES", "UPDATE"] | readonly ["CONFIGURACOES", "VIEW"],
  handler: typeof pushSync | typeof pullSync,
): void {
  router.post(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission(permission[0], permission[1]),
    createRateLimitMiddleware({ keyPrefix: `sync:${path}`, windowMs: 60_000, max: 120 }),
    auditMiddleware,
    handler,
  );
}

export function registerSyncRoutes(router: Router, prefix: string): void {
  registerSyncPath(router, `${prefix}/sync/push`, ["CONFIGURACOES", "UPDATE"], pushSync);
  registerSyncPath(router, `${prefix}/sync/pull`, ["CONFIGURACOES", "VIEW"], pullSync);
  registerSyncPath(router, `${prefix}/central/sync/push`, ["CONFIGURACOES", "UPDATE"], pushSync);
  registerSyncPath(router, `${prefix}/central/sync/pull`, ["CONFIGURACOES", "VIEW"], pullSync);
}
