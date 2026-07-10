import { StockController } from "../../modules/tenant/stock";
import { InventoryController } from "../../modules/tenant/stock/presentation/controllers/inventory.controller";
import { PurchasesController } from "../../modules/tenant/stock/presentation/controllers/purchases.controller";
import { SuppliersController } from "../../modules/tenant/stock/presentation/controllers/suppliers.controller";
import { RequisitionsController } from "../../modules/tenant/stock/presentation/controllers/requisitions.controller";
import { LotesController } from "../../modules/tenant/stock/presentation/controllers/lotes.controller";
import { EstoqueController } from "../../modules/tenant/stock/presentation/controllers/estoque.controller";
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
const suppliersController = new SuppliersController();
const inventoryController = new InventoryController();
const requisitionsController = new RequisitionsController();
const lotesController = new LotesController();
const estoqueController = new EstoqueController();

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
    `${prefix}/tenant/fornecedores/search`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("FORNECEDORES", "VIEW"),
    async (context) => suppliersController.search(context.req),
  );

  router.get(
    `${prefix}/tenant/compras/sugestoes`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COMPRAS", "VIEW"),
    async (context) => suppliersController.purchaseSuggestions(context.req),
  );

  router.get(
    `${prefix}/tenant/fornecedores/:fornecedorId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("FORNECEDORES", "VIEW"),
    async (context) => suppliersController.get(context.req),
  );

  router.post(
    `${prefix}/tenant/fornecedores`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("FORNECEDORES", "CREATE"),
    auditMiddleware,
    async (context) => suppliersController.create(context.req),
  );

  router.patch(
    `${prefix}/tenant/fornecedores/:fornecedorId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("FORNECEDORES", "UPDATE"),
    auditMiddleware,
    async (context) => suppliersController.update(context.req),
  );

  router.delete(
    `${prefix}/tenant/fornecedores/:fornecedorId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("FORNECEDORES", "DELETE"),
    auditMiddleware,
    async (context) => suppliersController.delete(context.req),
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

  router.patch(
    `${prefix}/tenant/${resourcePath}/${idParam}`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("REQUISICOES", "UPDATE"),
    auditMiddleware,
    async (context) => requisitionsController.updateRequisition(context.req),
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
  router.get(
    `${prefix}/tenant/requisicoes/produtos/search`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("REQUISICOES", "VIEW"),
    async (context) => requisitionsController.searchProdutos(context.req),
  );

  router.post(
    `${prefix}/tenant/lotes`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "CREATE_LOTE"),
    auditMiddleware,
    async (context) => requisitionsController.createLote(context.req),
  );

  router.get(
    `${prefix}/tenant/dashboard/estoque`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => estoqueController.dashboard(context.req),
  );

  router.get(
    `${prefix}/tenant/estoque`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => estoqueController.search(context.req),
  );

  router.get(
    `${prefix}/tenant/dashboard/lotes`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => lotesController.dashboard(context.req),
  );

  router.get(
    `${prefix}/tenant/dashboard/validades`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => lotesController.validadesDashboard(context.req),
  );

  router.get(
    `${prefix}/tenant/dashboard/fefo`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => lotesController.fefoDashboard(context.req),
  );

  router.get(
    `${prefix}/tenant/lotes`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => lotesController.search(context.req),
  );

  router.get(
    `${prefix}/tenant/validades/dashboard`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => lotesController.validadesDashboard(context.req),
  );

  router.get(
    `${prefix}/tenant/validades`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => lotesController.searchValidades(context.req),
  );

  router.get(
    `${prefix}/tenant/fefo/dashboard`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => lotesController.fefoDashboard(context.req),
  );

  router.get(
    `${prefix}/tenant/fefo/overview`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => lotesController.searchFefoOverview(context.req),
  );

  router.get(
    `${prefix}/tenant/fefo/audit`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => lotesController.searchFefoAudit(context.req),
  );

  router.get(
    `${prefix}/tenant/lotes/:loteId/movimentos`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => lotesController.listMovimentos(context.req),
  );

  router.get(
    `${prefix}/tenant/lotes/:loteId/reservas`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => lotesController.listReservas(context.req),
  );

  router.get(
    `${prefix}/tenant/lotes/:loteId/dispensacoes`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => lotesController.listDispensacoes(context.req),
  );

  router.get(
    `${prefix}/tenant/lotes/:loteId/incineracoes`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => lotesController.listIncineracoes(context.req),
  );

  router.post(
    `${prefix}/tenant/lotes/:loteId/quarentena`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "UPDATE"),
    auditMiddleware,
    async (context) =>
      lotesController.moveToQuarentena(
        context.req,
        getTenantAuth(context).userId,
      ),
  );

  router.post(
    `${prefix}/tenant/lotes/:loteId/liberar-quarentena`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "UPDATE"),
    auditMiddleware,
    async (context) =>
      lotesController.revertQuarentena(
        context.req,
        getTenantAuth(context).userId,
      ),
  );

  router.patch(
    `${prefix}/tenant/lotes/:loteId/precos`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "UPDATE"),
    auditMiddleware,
    async (context) =>
      lotesController.updatePrecos(
        context.req,
        getTenantAuth(context).userId,
      ),
  );

  router.patch(
    `${prefix}/tenant/lotes/:loteId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "UPDATE"),
    auditMiddleware,
    async (context) =>
      lotesController.update(context.req, getTenantAuth(context).userId),
  );

  router.post(
    `${prefix}/tenant/lotes/:loteId/movimentacao-sanitaria`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "UPDATE"),
    auditMiddleware,
    async (context) =>
      lotesController.movimentacaoSanitaria(
        context.req,
        getTenantAuth(context).userId,
      ),
  );

  router.get(
    `${prefix}/tenant/lotes/:loteId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => lotesController.get(context.req),
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
}

export function registerStockRoutes(router: Router, prefix: string): void {
  router.get(
    `${prefix}/tenant/stock/movements`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("ESTOQUE", "VIEW"),
    async (context) => stockController.listStockMovements(context.req),
  );

  registerReceiveRoute(router, `${prefix}/tenant/stock/receipts`);
  registerReceiveRoute(router, `${prefix}/tenant/stock/receive`);

  registerAdjustRoute(router, `${prefix}/tenant/stock/adjustments`);
  registerAdjustRoute(router, `${prefix}/tenant/stock/adjust`);

  registerPurchasesRoutes(router, prefix);
  registerInventoryRoutes(router, prefix);
  registerRequisitionRoutes(router, prefix);
}
