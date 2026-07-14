import { TerminalsController } from "../../modules/tenant/settings/presentation/controllers/terminals.controller";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  requirePermission,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import type { Router } from "../../shared/http/router";

const terminalsController = new TerminalsController();

export function registerSettingsRoutes(router: Router, prefix: string): void {
  router.get(
    `${prefix}/tenant/terminais/search`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CONFIGURACOES", "VIEW"),
    async (context) => terminalsController.search(context.req),
  );

  router.get(
    `${prefix}/tenant/terminais/:terminalId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CONFIGURACOES", "VIEW"),
    async (context) => terminalsController.get(context.req),
  );

  router.post(
    `${prefix}/tenant/terminais`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CONFIGURACOES", "CREATE"),
    auditMiddleware,
    async (context) => terminalsController.create(context.req),
  );

  router.patch(
    `${prefix}/tenant/terminais/:terminalId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CONFIGURACOES", "UPDATE"),
    auditMiddleware,
    async (context) => terminalsController.update(context.req),
  );

  router.delete(
    `${prefix}/tenant/terminais/:terminalId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CONFIGURACOES", "DELETE"),
    auditMiddleware,
    async (context) => terminalsController.delete(context.req),
  );
}
