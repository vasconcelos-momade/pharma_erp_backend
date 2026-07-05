import { z } from "zod";
import {
  CategoriaController,
  ProdutoController,
} from "../../modules/tenant/products";
import { LotesController } from "../../modules/tenant/stock/presentation/controllers/lotes.controller";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  getTenantAuth,
  requirePermission,
} from "../../shared/http/auth-middlewares";
import { categoriaIdParamSchema } from "../../modules/tenant/products/application/dto/categoria.dto";
import { auditMiddleware } from "../../shared/http/middlewares";
import { parseRouteParams } from "../../shared/http/request-validation";
import type { Router } from "../../shared/http/router";

const produtoController = new ProdutoController();
const categoriaController = new CategoriaController();
const lotesController = new LotesController();
const productIdParamSchema = z.object({
  productId: z.string().regex(/^\d+$/, "productId inválido"),
});

function registerProductResource(router: Router, path: string): void {
  router.get(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "VIEW"),
    async (context) => produtoController.search(context.req),
  );

  router.post(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "CREATE"),
    auditMiddleware,
    async (context) => produtoController.create(context.req, getTenantAuth(context).userId),
  );
}

function registerProductItemResource(router: Router, path: string): void {
  router.get(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "VIEW"),
    async (context) => {
      const { productId } = parseRouteParams(context.params, productIdParamSchema);
      return produtoController.get(productId);
    },
  );

  router.put(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "UPDATE"),
    auditMiddleware,
    async (context) => {
      const { productId } = parseRouteParams(context.params, productIdParamSchema);
      return produtoController.update(productId, context.req, getTenantAuth(context).userId);
    },
  );

  router.delete(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "DELETE"),
    auditMiddleware,
    async (context) => {
      const { productId } = parseRouteParams(context.params, productIdParamSchema);
      return produtoController.delete(productId, getTenantAuth(context).userId);
    },
  );
}

function registerCategoryResource(router: Router, path: string): void {
  router.get(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "VIEW"),
    async (context) => categoriaController.search(context.req),
  );

  router.post(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "CREATE"),
    auditMiddleware,
    async (context) =>
      categoriaController.create(context.req, getTenantAuth(context).userId),
  );
}

function registerCategoryActiveResource(router: Router, path: string): void {
  router.get(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "VIEW"),
    async () => categoriaController.listActive(),
  );
}

function registerCategoryItemResource(router: Router, path: string): void {
  router.get(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "VIEW"),
    async (context) => {
      const { categoryId } = parseRouteParams(context.params, categoriaIdParamSchema);
      return categoriaController.get(categoryId);
    },
  );

  router.put(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "UPDATE"),
    auditMiddleware,
    async (context) => {
      const { categoryId } = parseRouteParams(context.params, categoriaIdParamSchema);
      return categoriaController.update(
        categoryId,
        context.req,
        getTenantAuth(context).userId,
      );
    },
  );

  router.delete(
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "DELETE"),
    auditMiddleware,
    async (context) => {
      const { categoryId } = parseRouteParams(context.params, categoriaIdParamSchema);
      return categoriaController.delete(categoryId, getTenantAuth(context).userId);
    },
  );
}

export function registerProductRoutes(router: Router, prefix: string): void {
  router.get(
    `${prefix}/tenant/dashboard/produtos`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "VIEW"),
    async () => produtoController.dashboard(),
  );

  registerProductResource(router, `${prefix}/tenant/products`);
  registerProductResource(router, `${prefix}/tenant/produtos`);

  router.get(
    `${prefix}/tenant/produtos/tax-rules`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "VIEW"),
    async () => produtoController.listTaxRules(),
  );

  registerCategoryResource(router, `${prefix}/tenant/categories`);
  registerCategoryResource(router, `${prefix}/tenant/categorias`);
  registerCategoryActiveResource(router, `${prefix}/tenant/categories/active`);
  registerCategoryActiveResource(router, `${prefix}/tenant/categorias/ativas`);

  router.get(
    `${prefix}/tenant/categorias/stats`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "VIEW"),
    async () => categoriaController.stats(),
  );

  registerProductItemResource(router, `${prefix}/tenant/products/:productId`);
  registerProductItemResource(router, `${prefix}/tenant/produtos/:productId`);

  router.get(
    `${prefix}/tenant/produtos/:productId/historico-precos`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "VIEW"),
    async (context) => lotesController.listProductPriceHistory(context.req),
  );

  router.get(
    `${prefix}/tenant/produtos/:productId/fornecedores`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "VIEW"),
    async (context) => {
      const { productId } = parseRouteParams(context.params, productIdParamSchema);
      return produtoController.listSuppliers(context.req, productId);
    },
  );

  router.get(
    `${prefix}/tenant/produtos/:productId/historico`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "VIEW"),
    async (context) => {
      const { productId } = parseRouteParams(context.params, productIdParamSchema);
      return produtoController.listHistory(context.req, productId);
    },
  );

  router.get(
    `${prefix}/tenant/produtos/:productId/auditoria`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PRODUTOS", "VIEW"),
    async (context) => {
      const { productId } = parseRouteParams(context.params, productIdParamSchema);
      return produtoController.listAudit(context.req, productId);
    },
  );

  registerCategoryItemResource(router, `${prefix}/tenant/categories/:categoryId`);
  registerCategoryItemResource(router, `${prefix}/tenant/categorias/:categoryId`);
}
