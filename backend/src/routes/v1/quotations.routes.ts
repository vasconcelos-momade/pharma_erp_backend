import { CotacaoController } from "../../modules/tenant/sales";
import { cotacaoIdParamSchema } from "../../modules/tenant/sales/application/dto/cotacao.dto";
import {
  getTenantAuth,
  requirePermission,
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import { parseRouteParams } from "../../shared/http/request-validation";
import type { Router } from "../../shared/http/router";

const controller = new CotacaoController();
function registerResourceRoutes(router: Router, basePath: string): void {
  router.get(
    basePath,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COTACOES", "VIEW"),
    async (context) => controller.search(context.req),
  );

  router.post(
    basePath,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COTACOES", "CREATE"),
    auditMiddleware,
    async (context) =>
      controller.create(context.req, getTenantAuth(context).userId),
  );

  router.get(
    `${basePath}/:cotacaoId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COTACOES", "VIEW"),
    async (context) => {
      const { cotacaoId } = parseRouteParams(context.params, cotacaoIdParamSchema);
      return controller.get(cotacaoId);
    },
  );

  router.put(
    `${basePath}/:cotacaoId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COTACOES", "UPDATE"),
    auditMiddleware,
    async (context) => {
      const { cotacaoId } = parseRouteParams(context.params, cotacaoIdParamSchema);
      return controller.update(
        cotacaoId,
        context.req,
        getTenantAuth(context).userId,
      );
    },
  );

  router.delete(
    `${basePath}/:cotacaoId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COTACOES", "DELETE"),
    auditMiddleware,
    async (context) => {
      const { cotacaoId } = parseRouteParams(context.params, cotacaoIdParamSchema);
      return controller.delete(cotacaoId, getTenantAuth(context).userId);
    },
  );

  router.post(
    `${basePath}/:cotacaoId/aprovar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COTACOES", "APPROVE"),
    auditMiddleware,
    async (context) => {
      const { cotacaoId } = parseRouteParams(context.params, cotacaoIdParamSchema);
      return controller.approve(
        cotacaoId,
        context.req,
        getTenantAuth(context).userId,
      );
    },
  );

  router.post(
    `${basePath}/:cotacaoId/rejeitar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COTACOES", "REJECT"),
    auditMiddleware,
    async (context) => {
      const { cotacaoId } = parseRouteParams(context.params, cotacaoIdParamSchema);
      return controller.reject(
        cotacaoId,
        context.req,
        getTenantAuth(context).userId,
      );
    },
  );

  router.post(
    `${basePath}/:cotacaoId/expirar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COTACOES", "UPDATE"),
    auditMiddleware,
    async (context) => {
      const { cotacaoId } = parseRouteParams(context.params, cotacaoIdParamSchema);
      return controller.expire(
        cotacaoId,
        context.req,
        getTenantAuth(context).userId,
      );
    },
  );

  router.get(
    `${basePath}/:cotacaoId/auditoria`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COTACOES", "VIEW"),
    async (context) => {
      const { cotacaoId } = parseRouteParams(context.params, cotacaoIdParamSchema);
      return controller.listAudit(context.req, cotacaoId);
    },
  );
}

export function registerQuotationRoutes(router: Router, prefix: string): void {
  registerResourceRoutes(router, `${prefix}/tenant/cotacoes`);
  registerResourceRoutes(router, `${prefix}/tenant/quotations`);
}
