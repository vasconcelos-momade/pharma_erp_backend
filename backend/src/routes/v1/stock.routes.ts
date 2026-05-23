import { StockController } from "../../modules/tenant/stock";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  getTenantAuth,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import type { Router } from "../../shared/http/router";

const stockController = new StockController();

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

export function registerStockRoutes(router: Router, prefix: string): void {
  registerReceiveRoute(router, `${prefix}/tenant/stock/receipts`);
  registerReceiveRoute(router, `${prefix}/tenant/stock/receive`);

  registerAdjustRoute(router, `${prefix}/tenant/stock/adjustments`);
  registerAdjustRoute(router, `${prefix}/tenant/stock/adjust`);
}
