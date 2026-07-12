import { StockController } from "../../modules/tenant/stock";
import { InventoryController } from "../../modules/tenant/stock/presentation/controllers/inventory.controller";
import { SuppliersController } from "../../modules/tenant/stock/presentation/controllers/suppliers.controller";
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
const suppliersController = new SuppliersController();
const inventoryController = new InventoryController();
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

function registerPurchaseSuggestionsRoutes(router: Router, prefix: string): void {
  router.get(
    `${prefix}/tenant/compras/sugestoes`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COMPRAS", "VIEW"),
    async (context) => suppliersController.purchaseSuggestions(context.req),
  );

  router.post(
    `${prefix}/tenant/compras/sugestoes`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COMPRAS", "CREATE"),
    auditMiddleware,
    async (context) => suppliersController.addManualPurchaseSuggestion(context.req),
  );

  router.delete(
    `${prefix}/tenant/compras/sugestoes`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COMPRAS", "DELETE"),
    auditMiddleware,
    async () => suppliersController.clearPurchaseSuggestions(),
  );

  router.delete(
    `${prefix}/tenant/compras/sugestoes/:produtoId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("COMPRAS", "DELETE"),
    auditMiddleware,
    async (context) => suppliersController.removePurchaseSuggestion(context.req),
  );
}

function registerSupplierRoutes(router: Router, prefix: string): void {
  router.get(
    `${prefix}/tenant/fornecedores`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("FORNECEDORES", "VIEW"),
    async (context) => suppliersController.search(context.req),
  );

  router.get(
    `${prefix}/tenant/fornecedores/search`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("FORNECEDORES", "VIEW"),
    async (context) => suppliersController.search(context.req),
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

function registerLotesAndStockRoutes(router: Router, prefix: string): void {
  router.get(
    `${prefix}/tenant/stock/produtos/search`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "VIEW"),
    async (context) => lotesController.searchProdutos(context.req),
  );

  router.post(
    `${prefix}/tenant/lotes`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "CREATE_LOTE"),
    auditMiddleware,
    async (context) => lotesController.createLote(context.req, getTenantAuth(context).userId),
  );

  router.post(
    `${prefix}/tenant/estoque/entrada-compra`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("LOTES", "CREATE_LOTE"),
    auditMiddleware,
    async (context) =>
      estoqueController.entradaCompra(context.req, getTenantAuth(context).userId),
  );

  router.get(
    `${prefix}/tenant/estoque/movimentos`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("ESTOQUE", "VIEW"),
    async (context) => stockController.listStockMovements(context.req),
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
    async (context) => lotesController.listProductLots(context.req),
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

  registerPurchaseSuggestionsRoutes(router, prefix);
  registerSupplierRoutes(router, prefix);
  registerInventoryRoutes(router, prefix);
  registerLotesAndStockRoutes(router, prefix);
}
