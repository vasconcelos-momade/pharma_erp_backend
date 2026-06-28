import { AuditController } from "../../modules/tenant/audit/presentation/controllers/audit.controller";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  requirePermission,
} from "../../shared/http/auth-middlewares";
import type { Router } from "../../shared/http/router";

const controller = new AuditController();

export function registerAuditRoutes(router: Router, prefix: string): void {
  const paths = [`${prefix}/tenant/auditoria`, `${prefix}/tenant/audit`];

  for (const base of paths) {
    router.get(
      `${base}/dashboard`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("AUDITORIA", "VIEW"),
      async () => controller.dashboard(),
    );

    router.get(
      `${base}/logs`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("AUDITORIA", "VIEW"),
      async (context) => controller.listAuditLogs(context.req),
    );

    router.get(
      `${base}/eventos`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("AUDITORIA", "VIEW"),
      async (context) => controller.listBusinessEvents(context.req),
    );

    router.get(
      `${base}/events`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("AUDITORIA", "VIEW"),
      async (context) => controller.listBusinessEvents(context.req),
    );

    router.get(
      `${base}/integridade`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("AUDITORIA", "VIEW"),
      async () => controller.verifyIntegrity(),
    );
  }
}
