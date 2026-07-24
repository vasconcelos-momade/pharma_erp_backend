import { z } from "zod";
import { POSController } from "../../modules/tenant/pos";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  getTenantAuth,
  requirePermission,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import { parseRouteParams } from "../../shared/http/request-validation";
import type { RouteContext, Router } from "../../shared/http/router";
import type {
  TenantPermissionAction,
  TenantSystemModule,
} from "../../modules/tenant/shared/permission.constants";

const posController = new POSController();
const saleIdParamSchema = z.object({
  saleId: z.string().trim().min(1),
});

const draftCartItemIdParamSchema = z.object({
  itemId: z.string().regex(/^\d+$/, "itemId inválido"),
});

function withTenantPos(
  router: Router,
  method: "get" | "post",
  path: string,
  permissions: Array<readonly [TenantSystemModule, TenantPermissionAction]>,
  handler: (userId: string, context: RouteContext) => Promise<Response>,
): void {
  const middlewares = [
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    ...permissions.map(([module, action]) => requirePermission(module, action)),
  ] as const;

  if (method === "get") {
    router.get(path, ...middlewares, async (context: RouteContext) =>
      handler(getTenantAuth(context).userId, context),
    );
    return;
  }

  router.post(path, ...middlewares, auditMiddleware, async (context: RouteContext) =>
    handler(getTenantAuth(context).userId, context),
  );
}

export function registerPosRoutes(router: Router, prefix: string): void {
  withTenantPos(router, "get", `${prefix}/tenant/pos/faturas`, [["POS", "VIEW"]], async (_userId, context) =>
    posController.listFaturas(context.req),
  );
  withTenantPos(router, "get", `${prefix}/tenant/pos/faturas/:saleId`, [["POS", "VIEW"]], async (_userId, context) =>
    posController.getFaturaDetalhe(
      parseRouteParams(context.params, saleIdParamSchema).saleId,
    ),
  );
  withTenantPos(router, "get", `${prefix}/tenant/pos/faturas/:saleId/pdf`, [["POS", "EXPORT"]], async (userId, context) =>
    posController.downloadFaturaPdf(
      parseRouteParams(context.params, saleIdParamSchema).saleId,
      userId,
      context.req,
    ),
  );
  withTenantPos(router, "get", `${prefix}/tenant/pos/faturas/:saleId/print`, [["POS", "VIEW"]], async (userId, context) =>
    posController.getFaturaPrintArtifact(
      parseRouteParams(context.params, saleIdParamSchema).saleId,
      userId,
      context.req,
    ),
  );

  withTenantPos(router, "get", `${prefix}/tenant/pos/products/search`, [["PRODUTOS", "VIEW"]], async (_userId, context) =>
    posController.searchProdutos(context.req),
  );
  withTenantPos(router, "get", `${prefix}/tenant/pos/produtos/search`, [["PRODUTOS", "VIEW"]], async (_userId, context) =>
    posController.searchProdutos(context.req),
  );

  withTenantPos(router, "get", `${prefix}/tenant/pos/services/search`, [["POS", "VIEW"]], async (_userId, context) =>
    posController.searchServicos(context.req),
  );
  withTenantPos(router, "get", `${prefix}/tenant/pos/servicos/search`, [["POS", "VIEW"]], async (_userId, context) =>
    posController.searchServicos(context.req),
  );

  withTenantPos(router, "post", `${prefix}/tenant/pos/dispensation/validate`, [["POS", "APPROVE"]], async (_userId, context) =>
    posController.validarDispensacao(context.req),
  );
  withTenantPos(router, "post", `${prefix}/tenant/pos/validar-dispensacao`, [["POS", "APPROVE"]], async (_userId, context) =>
    posController.validarDispensacao(context.req),
  );

  withTenantPos(router, "post", `${prefix}/tenant/pos/checkout`, [["POS", "CREATE"]], async (userId, context) =>
    posController.finalizarVenda(context.req, userId),
  );
  withTenantPos(router, "post", `${prefix}/tenant/pos/finalizar`, [["POS", "CREATE"]], async (userId, context) =>
    posController.finalizarVenda(context.req, userId),
  );

  withTenantPos(router, "post", `${prefix}/tenant/pos/sales/:saleId/cancel`, [["POS", "CANCEL"]], async (userId, context: RouteContext) =>
    posController.anularFatura(
      context.req,
      userId,
      parseRouteParams(context.params, saleIdParamSchema).saleId,
    ),
  );
  withTenantPos(router, "post", `${prefix}/tenant/pos/faturas/:saleId/cancel`, [["POS", "CANCEL"]], async (userId, context: RouteContext) =>
    posController.anularFatura(
      context.req,
      userId,
      parseRouteParams(context.params, saleIdParamSchema).saleId,
    ),
  );

  withTenantPos(router, "post", `${prefix}/tenant/pos/sessions`, [["POS", "CREATE"]], async (userId, context) =>
    posController.abrirSessao(context.req, userId),
  );
  withTenantPos(router, "post", `${prefix}/tenant/pos/sessions/open`, [["POS", "CREATE"]], async (userId, context) =>
    posController.abrirSessao(context.req, userId),
  );

  withTenantPos(router, "post", `${prefix}/tenant/pos/sessions/close`, [["POS", "CLOSE_SHIFT"]], async (userId, context) =>
    posController.fecharSessao(context.req, userId),
  );

  withTenantPos(router, "get", `${prefix}/tenant/pos/sessions/current`, [["POS", "VIEW"]], async (userId) =>
    posController.getSessaoAtual(userId),
  );

  withTenantPos(router, "get", `${prefix}/tenant/pos/registers/available`, [["POS", "VIEW"]], async () =>
    posController.listAvailableCaixas(),
  );
  withTenantPos(router, "get", `${prefix}/tenant/pos/caixas/available`, [["POS", "VIEW"]], async () =>
    posController.listAvailableCaixas(),
  );

  withTenantPos(router, "get", `${prefix}/tenant/pos/sessions/report`, [["RELATORIOS", "VIEW"]], async (_userId, context) =>
    posController.getRelatorioDiferenca(context.req),
  );

  withTenantPos(router, "post", `${prefix}/tenant/pos/sales/draft`, [["POS", "CREATE"]], async (userId, context) =>
    posController.createDraftSale(context.req, userId),
  );

  router.get(
    `${prefix}/tenant/pos/sales/draft`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("POS", "VIEW"),
    async (context) => posController.getDraftCart(context.req, getTenantAuth(context).userId),
  );

  router.post(
    `${prefix}/tenant/pos/sales/draft/items`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("POS", "UPDATE"),
    auditMiddleware,
    async (context) => posController.addDraftCartItem(context.req, getTenantAuth(context).userId),
  );

  router.patch(
    `${prefix}/tenant/pos/sales/draft/items/:itemId/increment`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("POS", "UPDATE"),
    auditMiddleware,
    async (context) => {
      const { itemId } = parseRouteParams(context.params, draftCartItemIdParamSchema);
      return posController.incrementDraftCartItem(itemId, context.req, getTenantAuth(context).userId);
    },
  );

  router.patch(
    `${prefix}/tenant/pos/sales/draft/items/:itemId/decrement`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("POS", "UPDATE"),
    auditMiddleware,
    async (context) => {
      const { itemId } = parseRouteParams(context.params, draftCartItemIdParamSchema);
      return posController.decrementDraftCartItem(itemId, context.req, getTenantAuth(context).userId);
    },
  );

  router.delete(
    `${prefix}/tenant/pos/sales/draft/items/:itemId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("POS", "DELETE"),
    auditMiddleware,
    async (context) => {
      const { itemId } = parseRouteParams(context.params, draftCartItemIdParamSchema);
      return posController.removeDraftCartItem(itemId, context.req, getTenantAuth(context).userId);
    },
  );

  withTenantPos(router, "post", `${prefix}/tenant/pos/agreements/liquidations`, [["POS", "CREATE"]], async (userId, context) =>
    posController.liquidarConvenio(context.req, userId),
  );
  withTenantPos(router, "post", `${prefix}/tenant/pos/convenios/liquidate`, [["POS", "CREATE"]], async (userId, context) =>
    posController.liquidarConvenio(context.req, userId),
  );

  withTenantPos(router, "get", `${prefix}/tenant/pos/tax-rules`, [["CONFIGURACOES", "VIEW"]], async () =>
    posController.listTaxRules(),
  );
}
