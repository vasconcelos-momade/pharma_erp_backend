import { StockController } from "../../modules/tenant/stock";
import { PurchasesController } from "../../modules/tenant/stock/presentation/controllers/purchases.controller";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  getTenantAuth,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import type { Router } from "../../shared/http/router";

const stockController = new StockController();
const purchasesController = new PurchasesController();

function registerReceiveRoute(router: Router, path: string): void {
  router.post(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) => stockController.receivePurchase(context.req, getTenantAuth(context).userId),
  );
}

function registerAdjustRoute(router: Router, path: string): void {
  router.post(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) => stockController.adjustStock(context.req, getTenantAuth(context).userId),
  );
}

function registerPurchasesRoutes(router: Router, prefix: string): void {
  router.post(
    `${prefix}/tenant/compras`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) => purchasesController.createPendingPurchase(context.req, getTenantAuth(context).userId),
  );

  router.get(
    `${prefix}/tenant/fornecedores`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    async (context) => purchasesController.listSuppliers(context.req),
  );

  router.get(
    `${prefix}/tenant/compras`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    async (context) => purchasesController.listPurchases(context.req),
  );

  router.get(
    `${prefix}/tenant/compras/:compraId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    async (context) => purchasesController.getPurchaseDetail(context.req),
  );

  router.post(
    `${prefix}/tenant/compras/:compraId/items`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) => purchasesController.addPurchaseItem(context.req),
  );

  router.delete(
    `${prefix}/tenant/compras/:compraId/items/:itemId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) => purchasesController.removePurchaseItem(context.req),
  );

  router.post(
    `${prefix}/tenant/compras/:compraId/confirmar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) => purchasesController.confirmPurchase(context.req, getTenantAuth(context).userId),
  );
}

export function registerStockRoutes(router: Router, prefix: string): void {
  registerReceiveRoute(router, `${prefix}/tenant/stock/receipts`);
  registerReceiveRoute(router, `${prefix}/tenant/stock/receive`);

  registerAdjustRoute(router, `${prefix}/tenant/stock/adjustments`);
  registerAdjustRoute(router, `${prefix}/tenant/stock/adjust`);

  registerPurchasesRoutes(router, prefix);
}
