import { FinanceController } from "../../modules/tenant/finance/presentation/controllers/finance.controller";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  getTenantAuth,
  requirePermission,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import type { Router } from "../../shared/http/router";

const financeController = new FinanceController();

export function registerFinanceRoutes(router: Router, prefix: string): void {
  const readAuth = [
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "VIEW"),
  ] as const;

  const writeAuth = [
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CAIXA", "CREATE"),
    auditMiddleware,
  ] as const;

  router.get(
    `${prefix}/tenant/finance/cashflow/context`,
    ...readAuth,
    async (context) =>
      financeController.cashflowContext(getTenantAuth(context).userId),
  );

  router.get(
    `${prefix}/tenant/finance/cashflow/movimentos`,
    ...readAuth,
    async (context) => financeController.listMovements(context.req),
  );

  router.post(
    `${prefix}/tenant/finance/cashflow/saida`,
    ...writeAuth,
    async (context) =>
      financeController.registerSaida(context.req, getTenantAuth(context).userId),
  );

  router.post(
    `${prefix}/tenant/finance/cashflow/suprimento`,
    ...writeAuth,
    async (context) =>
      financeController.registerSuprimento(
        context.req,
        getTenantAuth(context).userId,
      ),
  );

  router.post(
    `${prefix}/tenant/finance/cashflow/sangria`,
    ...writeAuth,
    async (context) =>
      financeController.registerSangria(context.req, getTenantAuth(context).userId),
  );

  router.post(
    `${prefix}/tenant/finance/cashflow/estorno`,
    ...writeAuth,
    async (context) =>
      financeController.registerEstorno(context.req, getTenantAuth(context).userId),
  );
}
