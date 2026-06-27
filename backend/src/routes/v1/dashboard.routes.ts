import { DashboardController } from "../../modules/tenant/dashboard/presentation/dashboard.controller";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  requirePermission,
} from "../../shared/http/auth-middlewares";
import type { Router } from "../../shared/http/router";

const dashboardController = new DashboardController();

export function registerDashboardRoutes(router: Router, prefix: string): void {
  const auth = [
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "VIEW"),
  ] as const;

  router.get(
    `${prefix}/tenant/dashboard/executivo`,
    ...auth,
    async (context) => dashboardController.executive(context.req),
  );

  router.get(
    `${prefix}/tenant/dashboard/executivo/tables`,
    ...auth,
    async (context) => dashboardController.executiveTable(context.req),
  );

  router.get(
    `${prefix}/tenant/dashboard/financeiro`,
    ...auth,
    async (context) => dashboardController.finance(context.req),
  );

  router.get(
    `${prefix}/tenant/dashboard/financeiro/tables`,
    ...auth,
    async (context) => dashboardController.financeTable(context.req),
  );

  router.get(
    `${prefix}/tenant/dashboard/farmacia`,
    ...auth,
    async (context) => dashboardController.pharmacy(context.req),
  );

  router.get(
    `${prefix}/tenant/dashboard/farmacia/tables`,
    ...auth,
    async (context) => dashboardController.pharmacyTable(context.req),
  );

  router.get(
    `${prefix}/tenant/dashboard/stock`,
    ...auth,
    async (context) => dashboardController.stock(context.req),
  );

  router.get(
    `${prefix}/tenant/dashboard/stock/tables`,
    ...auth,
    async (context) => dashboardController.stockTable(context.req),
  );
}
