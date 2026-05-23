import { z } from "zod";
import { POSController } from "../../modules/tenant/pos";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  getTenantAuth,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import { parseRouteParams } from "../../shared/http/request-validation";
import type { RouteContext, Router } from "../../shared/http/router";

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
  handler: (userId: string, context: RouteContext) => Promise<Response>,
): void {
  const middlewares = [tenantAuthMiddleware(), tenantBranchContextMiddleware()] as const;

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
  withTenantPos(router, "get", `${prefix}/tenant/pos/products/search`, async (_userId, context) =>
    posController.searchProdutos(context.req),
  );
  withTenantPos(router, "get", `${prefix}/tenant/pos/produtos/search`, async (_userId, context) =>
    posController.searchProdutos(context.req),
  );

  withTenantPos(router, "get", `${prefix}/tenant/pos/services/search`, async (_userId, context) =>
    posController.searchServicos(context.req),
  );
  withTenantPos(router, "get", `${prefix}/tenant/pos/servicos/search`, async (_userId, context) =>
    posController.searchServicos(context.req),
  );

  withTenantPos(router, "post", `${prefix}/tenant/pos/dispensation/validate`, async (_userId, context) =>
    posController.validarDispensacao(context.req),
  );
  withTenantPos(router, "post", `${prefix}/tenant/pos/validar-dispensacao`, async (_userId, context) =>
    posController.validarDispensacao(context.req),
  );

  withTenantPos(router, "post", `${prefix}/tenant/pos/checkout`, async (userId, context) =>
    posController.finalizarVenda(context.req, userId),
  );
  withTenantPos(router, "post", `${prefix}/tenant/pos/finalizar`, async (userId, context) =>
    posController.finalizarVenda(context.req, userId),
  );

  withTenantPos(router, "post", `${prefix}/tenant/pos/sales/:saleId/cancel`, async (userId, context: RouteContext) =>
    posController.anularFatura(
      context.req,
      userId,
      parseRouteParams(context.params, saleIdParamSchema).saleId,
    ),
  );
  withTenantPos(router, "post", `${prefix}/tenant/pos/faturas/:saleId/cancel`, async (userId, context: RouteContext) =>
    posController.anularFatura(
      context.req,
      userId,
      parseRouteParams(context.params, saleIdParamSchema).saleId,
    ),
  );

  withTenantPos(router, "post", `${prefix}/tenant/pos/sessions`, async (userId, context) =>
    posController.abrirSessao(context.req, userId),
  );
  withTenantPos(router, "post", `${prefix}/tenant/pos/sessions/open`, async (userId, context) =>
    posController.abrirSessao(context.req, userId),
  );

  withTenantPos(router, "post", `${prefix}/tenant/pos/sessions/close`, async (userId, context) =>
    posController.fecharSessao(context.req, userId),
  );

  withTenantPos(router, "get", `${prefix}/tenant/pos/sessions/current`, async (userId) =>
    posController.getSessaoAtual(userId),
  );

  withTenantPos(router, "get", `${prefix}/tenant/pos/registers/available`, async () =>
    posController.listAvailableCaixas(),
  );
  withTenantPos(router, "get", `${prefix}/tenant/pos/caixas/available`, async () =>
    posController.listAvailableCaixas(),
  );

  withTenantPos(router, "get", `${prefix}/tenant/pos/sessions/report`, async (_userId, context) =>
    posController.getRelatorioDiferenca(context.req),
  );

  withTenantPos(router, "post", `${prefix}/tenant/pos/sales/draft`, async (userId, context) =>
    posController.createDraftSale(context.req, userId),
  );

  router.get(
    `${prefix}/tenant/pos/sales/draft`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    async (context) => posController.getDraftCart(context.req, getTenantAuth(context).userId),
  );

  router.post(
    `${prefix}/tenant/pos/sales/draft/items`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) => posController.addDraftCartItem(context.req, getTenantAuth(context).userId),
  );

  router.patch(
    `${prefix}/tenant/pos/sales/draft/items/:itemId/increment`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
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
    auditMiddleware,
    async (context) => {
      const { itemId } = parseRouteParams(context.params, draftCartItemIdParamSchema);
      return posController.removeDraftCartItem(itemId, context.req, getTenantAuth(context).userId);
    },
  );

  withTenantPos(router, "post", `${prefix}/tenant/pos/agreements/liquidations`, async (userId, context) =>
    posController.liquidarConvenio(context.req, userId),
  );
  withTenantPos(router, "post", `${prefix}/tenant/pos/convenios/liquidate`, async (userId, context) =>
    posController.liquidarConvenio(context.req, userId),
  );

  withTenantPos(router, "get", `${prefix}/tenant/pos/tax-rules`, async () =>
    posController.listTaxRules(),
  );
}
