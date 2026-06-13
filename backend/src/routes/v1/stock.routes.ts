import { StockController } from "../../modules/tenant/stock";
import { InventoryController } from "../../modules/tenant/stock/presentation/controllers/inventory.controller";
import { PurchasesController } from "../../modules/tenant/stock/presentation/controllers/purchases.controller";
import { RequisitionsController } from "../../modules/tenant/stock/presentation/controllers/requisitions.controller";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  getTenantAuth,
  requirePermission,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import type { Router } from "../../shared/http/router";

const stockController = new StockController();
const purchasesController = new PurchasesController();
const inventoryController = new InventoryController();
const requisitionsController = new RequisitionsController();

function registerReceiveRoute(router: Router, path: string): void {
  router.post(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COMPRAS", "CREATE"),
    requirePermission("LOTES", "CREATE_LOTE"),
    auditMiddleware,
    async (context) => stockController.receivePurchase(context.req, getTenantAuth(context).userId),
  );
}

function registerAdjustRoute(router: Router, path: string): void {
  router.post(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("INVENTARIO", "ADJUST_STOCK"),
    auditMiddleware,
    async (context) => stockController.adjustStock(context.req, getTenantAuth(context).userId),
  );
}

function registerPurchasesRoutes(router: Router, prefix: string): void {
  router.post(
    `${prefix}/tenant/compras`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COMPRAS", "CREATE"),
    auditMiddleware,
    async (context) => purchasesController.createPendingPurchase(context.req, getTenantAuth(context).userId),
  );

  router.get(
    `${prefix}/tenant/fornecedores`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("FORNECEDORES", "VIEW"),
    async (context) => purchasesController.listSuppliers(context.req),
  );

  router.get(
    `${prefix}/tenant/compras`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COMPRAS", "VIEW"),
    async (context) => purchasesController.listPurchases(context.req),
  );

  router.get(
    `${prefix}/tenant/compras/:compraId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COMPRAS", "VIEW"),
    async (context) => purchasesController.getPurchaseDetail(context.req),
  );

  router.post(
    `${prefix}/tenant/compras/:compraId/items`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COMPRAS", "UPDATE"),
    auditMiddleware,
    async (context) => purchasesController.addPurchaseItem(context.req),
  );

  router.patch(
    `${prefix}/tenant/compras/:compraId/items/:itemId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COMPRAS", "UPDATE"),
    auditMiddleware,
    async (context) => purchasesController.updatePurchaseItem(context.req),
  );

  router.delete(
    `${prefix}/tenant/compras/:compraId/items/:itemId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COMPRAS", "DELETE"),
    auditMiddleware,
    async (context) => purchasesController.removePurchaseItem(context.req),
  );

  router.post(
    `${prefix}/tenant/compras/:compraId/confirmar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COMPRAS", "APPROVE"),
    requirePermission("LOTES", "CREATE_LOTE"),
    auditMiddleware,
    async (context) => purchasesController.confirmPurchase(context.req, getTenantAuth(context).userId),
  );
}

function registerInventoryRoutes(router: Router, prefix: string): void {
  router.post(
    `${prefix}/tenant/inventarios`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("INVENTARIO", "CREATE"),
    auditMiddleware,
    async (context) =>
      inventoryController.openInventory(
        context.req,
        getTenantAuth(context).userId,
      ),
  );

  router.get(
    `${prefix}/tenant/inventarios`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("INVENTARIO", "VIEW"),
    async (context) => inventoryController.listInventories(context.req),
  );

  router.get(
    `${prefix}/tenant/inventarios/:inventarioId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("INVENTARIO", "VIEW"),
    async (context) => inventoryController.getInventoryDetail(context.req),
  );

  router.get(
    `${prefix}/tenant/inventarios/:inventarioId/itens`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("INVENTARIO", "VIEW"),
    async (context) => inventoryController.listInventoryItems(context.req),
  );

  router.post(
    `${prefix}/tenant/inventarios/:inventarioId/iniciar-contagem`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("INVENTARIO", "UPDATE"),
    auditMiddleware,
    async (context) => inventoryController.startCounting(context.req),
  );

  router.patch(
    `${prefix}/tenant/inventarios/:inventarioId/itens/:itemId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("INVENTARIO", "UPDATE"),
    auditMiddleware,
    async (context) => inventoryController.recordCount(context.req),
  );

  router.post(
    `${prefix}/tenant/inventarios/:inventarioId/reconciliar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("INVENTARIO", "APPROVE"),
    requirePermission("INVENTARIO", "ADJUST_STOCK"),
    auditMiddleware,
    async (context) =>
      inventoryController.reconcile(
        context.req,
        getTenantAuth(context).userId,
      ),
  );

  router.post(
    `${prefix}/tenant/inventarios/:inventarioId/cancelar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("INVENTARIO", "CANCEL"),
    auditMiddleware,
    async (context) => inventoryController.cancel(context.req),
  );
}

function registerRequisitionRoutesForResource(
  router: Router,
  prefix: string,
  resourcePath: string,
  idParam: string,
): void {
  router.post(
    `${prefix}/tenant/${resourcePath}`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("REQUISICOES", "CREATE"),
    auditMiddleware,
    async (context) =>
      requisitionsController.createRequisition(
        context.req,
        getTenantAuth(context).userId,
      ),
  );

  router.get(
    `${prefix}/tenant/${resourcePath}`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("REQUISICOES", "VIEW"),
    async (context) => requisitionsController.listRequisitions(context.req),
  );

  router.get(
    `${prefix}/tenant/${resourcePath}/${idParam}`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("REQUISICOES", "VIEW"),
    async (context) => requisitionsController.getRequisitionDetail(context.req),
  );

  router.post(
    `${prefix}/tenant/${resourcePath}/${idParam}/items`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("REQUISICOES", "UPDATE"),
    auditMiddleware,
    async (context) => requisitionsController.addRequisitionItem(context.req),
  );

  router.patch(
    `${prefix}/tenant/${resourcePath}/${idParam}/items/:itemId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("REQUISICOES", "UPDATE"),
    auditMiddleware,
    async (context) => requisitionsController.updateRequisitionItem(context.req),
  );

  router.delete(
    `${prefix}/tenant/${resourcePath}/${idParam}/items/:itemId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("REQUISICOES", "DELETE"),
    auditMiddleware,
    async (context) => requisitionsController.removeRequisitionItem(context.req),
  );

  router.post(
    `${prefix}/tenant/${resourcePath}/${idParam}/aprovar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("REQUISICOES", "APPROVE"),
    auditMiddleware,
    async (context) =>
      requisitionsController.approveRequisition(
        context.req,
        getTenantAuth(context).userId,
      ),
  );

  router.post(
    `${prefix}/tenant/${resourcePath}/${idParam}/rejeitar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("REQUISICOES", "REJECT"),
    auditMiddleware,
    async (context) =>
      requisitionsController.rejectRequisition(
        context.req,
        getTenantAuth(context).userId,
      ),
  );

  router.post(
    `${prefix}/tenant/${resourcePath}/${idParam}/confirmar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("REQUISICOES", "APPROVE"),
    auditMiddleware,
    async (context) =>
      requisitionsController.confirmRequisition(
        context.req,
        getTenantAuth(context).userId,
      ),
  );

  router.post(
    `${prefix}/tenant/${resourcePath}/${idParam}/cancelar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("REQUISICOES", "CANCEL"),
    auditMiddleware,
    async (context) =>
      requisitionsController.cancelRequisition(
        context.req,
        getTenantAuth(context).userId,
      ),
  );
}

function registerRequisitionRoutes(router: Router, prefix: string): void {
  router.post(
    `${prefix}/tenant/lotes`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "CREATE_LOTE"),
    auditMiddleware,
    async (context) => requisitionsController.createLote(context.req),
  );

  router.get(
    `${prefix}/tenant/produtos/:produtoId/lotes`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => requisitionsController.listProductLots(context.req),
  );

  registerRequisitionRoutesForResource(
    router,
    prefix,
    "requisicoes",
    ":requisicaoId",
  );
  // Alias legado da API (clientes antigos) — preferir /tenant/requisicoes.
  registerRequisitionRoutesForResource(
    router,
    prefix,
    "transferencias",
    ":requisicaoId",
  );
}

export function registerStockRoutes(router: Router, prefix: string): void {
  registerReceiveRoute(router, `${prefix}/tenant/stock/receipts`);
  registerReceiveRoute(router, `${prefix}/tenant/stock/receive`);

  registerAdjustRoute(router, `${prefix}/tenant/stock/adjustments`);
  registerAdjustRoute(router, `${prefix}/tenant/stock/adjust`);

  registerPurchasesRoutes(router, prefix);
  registerInventoryRoutes(router, prefix);
  registerRequisitionRoutes(router, prefix);
}
