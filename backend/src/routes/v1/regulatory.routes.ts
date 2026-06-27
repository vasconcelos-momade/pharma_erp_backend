import { RegulatoryController } from "../../modules/tenant/regulatory";
import {
  getTenantAuth,
  requirePermission,
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import { parseRouteParams } from "../../shared/http/request-validation";
import type { Router } from "../../shared/http/router";
import {
  livroPsicotropicoIdParamSchema,
  livroReceitaIdParamSchema,
  loteIdParamSchema,
  receitaIdParamSchema,
} from "../../modules/tenant/regulatory/application/dto/regulatory.dto";

const controller = new RegulatoryController();

export function registerRegulatoryRoutes(router: Router, prefix: string): void {
  router.get(
    `${prefix}/tenant/regulatory/receitas/dashboard`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "VIEW"),
    async (context) => controller.receitasDashboard(context.req),
  );

  router.get(
    `${prefix}/tenant/regulatory/receitas`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "VIEW"),
    async (context) => controller.listReceitas(context.req),
  );

  router.post(
    `${prefix}/tenant/regulatory/receitas`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "CREATE"),
    auditMiddleware,
    async (context) => controller.createReceita(context.req),
  );

  router.get(
    `${prefix}/tenant/regulatory/receitas/:receitaId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "VIEW"),
    async (context) => {
      const { receitaId } = parseRouteParams(context.params, receitaIdParamSchema);
      return controller.getReceita(receitaId);
    },
  );

  router.patch(
    `${prefix}/tenant/regulatory/receitas/:receitaId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "UPDATE"),
    auditMiddleware,
    async (context) => {
      const { receitaId } = parseRouteParams(context.params, receitaIdParamSchema);
      return controller.updateReceita(receitaId, context.req);
    },
  );

  router.delete(
    `${prefix}/tenant/regulatory/receitas/:receitaId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CLIENTES", "DELETE"),
    auditMiddleware,
    async (context) => {
      const { receitaId } = parseRouteParams(context.params, receitaIdParamSchema);
      return controller.deleteReceita(receitaId);
    },
  );

  router.get(
    `${prefix}/tenant/regulatory/livro-receitas/dashboard`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "VIEW"),
    async (context) => controller.livroReceitasDashboard(context.req),
  );

  router.get(
    `${prefix}/tenant/regulatory/livro-receitas`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "VIEW"),
    async (context) => controller.listLivroReceitas(context.req),
  );

  router.get(
    `${prefix}/tenant/regulatory/livro-receitas/:entryId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "VIEW"),
    async (context) => {
      const { entryId } = parseRouteParams(
        context.params,
        livroReceitaIdParamSchema,
      );
      return controller.getLivroReceita(entryId);
    },
  );

  router.get(
    `${prefix}/tenant/regulatory/livro-psicotropicos/dashboard`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PSICOTROPICOS", "VIEW"),
    async (context) => controller.livroPsicotropicosDashboard(context.req),
  );

  router.get(
    `${prefix}/tenant/regulatory/livro-psicotropicos`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PSICOTROPICOS", "VIEW"),
    async (context) => controller.listLivroPsicotropicos(context.req),
  );

  router.get(
    `${prefix}/tenant/regulatory/livro-psicotropicos/:entryId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PSICOTROPICOS", "VIEW"),
    async (context) => {
      const { entryId } = parseRouteParams(
        context.params,
        livroPsicotropicoIdParamSchema,
      );
      return controller.getLivroPsicotropico(entryId);
    },
  );

  router.get(
    `${prefix}/tenant/regulatory/sanitario/dashboard`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "VIEW"),
    async (context) => controller.sanitarioDashboard(context.req),
  );

  router.get(
    `${prefix}/tenant/regulatory/sanitario`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "VIEW"),
    async (context) => controller.listSanitario(context.req),
  );

  router.get(
    `${prefix}/tenant/regulatory/sanitario/lotes/:loteId/historico`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "VIEW"),
    async (context) => {
      const { loteId } = parseRouteParams(context.params, loteIdParamSchema);
      return controller.getSanitarioLoteHistory(loteId);
    },
  );

  router.get(
    `${prefix}/tenant/regulatory/sanitario/relatorios`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "VIEW"),
    async (context) => controller.listSanitarioReports(context.req),
  );
}
