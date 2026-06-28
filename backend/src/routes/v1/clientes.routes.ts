import { z } from "zod";
import { ClienteController } from "../../modules/tenant/clients";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  getTenantAuth,
  requirePermission,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import { parseRouteParams } from "../../shared/http/request-validation";
import type { Router } from "../../shared/http/router";

const controller = new ClienteController();
const clienteIdParamSchema = z.object({
  clienteId: z.string().regex(/^\d+$/, "clienteId inválido"),
});

function registerClienteRoutes(router: Router, basePath: string): void {
  router.get(
    basePath,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "VIEW"),
    async (context) => controller.search(context.req),
  );

  router.post(
    basePath,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "CREATE"),
    auditMiddleware,
    async (context) => controller.create(context.req, getTenantAuth(context).userId),
  );

  router.get(
    `${basePath}/dashboard`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "VIEW"),
    async () => controller.dashboard(),
  );

  router.get(
    `${basePath}/:clienteId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "VIEW"),
    async (context) => {
      const { clienteId } = parseRouteParams(context.params, clienteIdParamSchema);
      return controller.get(clienteId);
    },
  );

  router.put(
    `${basePath}/:clienteId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "UPDATE"),
    auditMiddleware,
    async (context) => {
      const { clienteId } = parseRouteParams(context.params, clienteIdParamSchema);
      return controller.update(clienteId, context.req, getTenantAuth(context).userId);
    },
  );

  router.delete(
    `${basePath}/:clienteId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "DELETE"),
    auditMiddleware,
    async (context) => {
      const { clienteId } = parseRouteParams(context.params, clienteIdParamSchema);
      return controller.delete(clienteId, getTenantAuth(context).userId);
    },
  );

  router.get(
    `${basePath}/:clienteId/faturas`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "VIEW"),
    async (context) => {
      const { clienteId } = parseRouteParams(context.params, clienteIdParamSchema);
      return controller.listFaturas(context.req, clienteId);
    },
  );

  router.get(
    `${basePath}/:clienteId/contas-receber`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "VIEW"),
    async (context) => {
      const { clienteId } = parseRouteParams(context.params, clienteIdParamSchema);
      return controller.listContasReceber(context.req, clienteId);
    },
  );

  router.get(
    `${basePath}/:clienteId/receitas`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "VIEW"),
    async (context) => {
      const { clienteId } = parseRouteParams(context.params, clienteIdParamSchema);
      return controller.listReceitas(context.req, clienteId);
    },
  );

  router.get(
    `${basePath}/:clienteId/auditoria`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "VIEW"),
    async (context) => {
      const { clienteId } = parseRouteParams(context.params, clienteIdParamSchema);
      return controller.listAudit(context.req, clienteId);
    },
  );
}

export function registerClientesRoutes(router: Router, prefix: string): void {
  registerClienteRoutes(router, `${prefix}/tenant/clientes`);
  registerClienteRoutes(router, `${prefix}/tenant/customers`);
}
