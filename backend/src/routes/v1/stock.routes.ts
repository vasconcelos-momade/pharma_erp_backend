import { StockController } from "../../modules/tenant/stock";
import { InventoryController } from "../../modules/tenant/stock/presentation/controllers/inventory.controller";
import { PurchasesController } from "../../modules/tenant/stock/presentation/controllers/purchases.controller";
import { TransfersController } from "../../modules/tenant/stock/presentation/controllers/transfers.controller";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  getTenantAuth,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import type { Router } from "../../shared/http/router";

const stockController = new StockController();
const purchasesController = new PurchasesController();
const inventoryController = new InventoryController();
const transfersController = new TransfersController();

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

  router.patch(
    `${prefix}/tenant/compras/:compraId/items/:itemId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) => purchasesController.updatePurchaseItem(context.req),
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

function registerInventoryRoutes(router: Router, prefix: string): void {
  router.post(
    `${prefix}/tenant/inventarios`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
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
    async (context) => inventoryController.listInventories(context.req),
  );

  router.get(
    `${prefix}/tenant/inventarios/:inventarioId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    async (context) => inventoryController.getInventoryDetail(context.req),
  );

  router.get(
    `${prefix}/tenant/inventarios/:inventarioId/itens`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    async (context) => inventoryController.listInventoryItems(context.req),
  );

  router.post(
    `${prefix}/tenant/inventarios/:inventarioId/iniciar-contagem`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) => inventoryController.startCounting(context.req),
  );

  router.patch(
    `${prefix}/tenant/inventarios/:inventarioId/itens/:itemId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) => inventoryController.recordCount(context.req),
  );

  router.post(
    `${prefix}/tenant/inventarios/:inventarioId/reconciliar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
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
    auditMiddleware,
    async (context) => inventoryController.cancel(context.req),
  );
}

function registerTransferRoutes(router: Router, prefix: string): void {
  router.post(
    `${prefix}/tenant/transferencias`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) =>
      transfersController.createTransfer(
        context.req,
        getTenantAuth(context).userId,
      ),
  );

  router.get(
    `${prefix}/tenant/transferencias`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    async (context) => transfersController.listTransfers(context.req),
  );

  router.get(
    `${prefix}/tenant/transferencias/:transferenciaId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    async (context) => transfersController.getTransferDetail(context.req),
  );

  router.get(
    `${prefix}/tenant/produtos/:produtoId/lotes`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    async (context) => transfersController.listProductLots(context.req),
  );

  router.post(
    `${prefix}/tenant/transferencias/:transferenciaId/items`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) => transfersController.addTransferItem(context.req),
  );

  router.patch(
    `${prefix}/tenant/transferencias/:transferenciaId/items/:itemId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) => transfersController.updateTransferItem(context.req),
  );

  router.delete(
    `${prefix}/tenant/transferencias/:transferenciaId/items/:itemId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) => transfersController.removeTransferItem(context.req),
  );

  router.post(
    `${prefix}/tenant/transferencias/:transferenciaId/confirmar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) =>
      transfersController.confirmTransfer(
        context.req,
        getTenantAuth(context).userId,
      ),
  );

  router.post(
    `${prefix}/tenant/transferencias/:transferenciaId/cancelar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    auditMiddleware,
    async (context) =>
      transfersController.cancelTransfer(
        context.req,
        getTenantAuth(context).userId,
      ),
  );
}

export function registerStockRoutes(router: Router, prefix: string): void {
  registerReceiveRoute(router, `${prefix}/tenant/stock/receipts`);
  registerReceiveRoute(router, `${prefix}/tenant/stock/receive`);

  registerAdjustRoute(router, `${prefix}/tenant/stock/adjustments`);
  registerAdjustRoute(router, `${prefix}/tenant/stock/adjust`);

  registerPurchasesRoutes(router, prefix);
  registerInventoryRoutes(router, prefix);
  registerTransferRoutes(router, prefix);
}
