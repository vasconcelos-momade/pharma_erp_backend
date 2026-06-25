import { z } from "zod";
import { ProdutoController } from "../../modules/tenant/products";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  getTenantAuth,
  requirePermission,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import { parseRouteParams } from "../../shared/http/request-validation";
import type { Router } from "../../shared/http/router";

const produtoController = new ProdutoController();
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

export function registerProductRoutes(router: Router, prefix: string): void {
  registerProductResource(router, `${prefix}/tenant/products`);
  registerProductResource(router, `${prefix}/tenant/produtos`);

  registerProductItemResource(router, `${prefix}/tenant/products/:productId`);
  registerProductItemResource(router, `${prefix}/tenant/produtos/:productId`);
}
