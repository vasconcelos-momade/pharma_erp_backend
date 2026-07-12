import { ReportsController } from "../../modules/tenant/reports";
import { REPORT_KEYS } from "../../modules/tenant/reports/application/constants/report-keys";
import {
  getTenantAuth,
  requirePermission,
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
} from "../../shared/http/auth-middlewares";
import type { Router } from "../../shared/http/router";

const controller = new ReportsController();

export function registerReportsRoutes(router: Router, prefix: string): void {
  router.get(
    `${prefix}/reports/expiry`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "EXPORT"),
    async (context) => controller.expiry(context.req, getTenantAuth(context).userId),
  );

  router.get(
    `${prefix}/reports/invoices/:faturaId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "EXPORT"),
    async (context) =>
      controller.invoice(context.req, context.params, getTenantAuth(context).userId),
  );

  router.get(
    `${prefix}/reports/invoices`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "EXPORT"),
    async (context) =>
      controller.invoiceList(context.req, getTenantAuth(context).userId),
  );

  router.get(
    `${prefix}/reports/sales-history`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "EXPORT"),
    async (context) =>
      controller.salesHistory(context.req, getTenantAuth(context).userId),
  );

  router.get(
    `${prefix}/reports/customers`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "EXPORT"),
    async (context) =>
      controller.customers(context.req, getTenantAuth(context).userId),
  );

  router.get(
    `${prefix}/reports/proforma-invoices/:proformaInvoiceId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "EXPORT"),
    async (context) =>
      controller.proformaInvoice(context.req, context.params, getTenantAuth(context).userId),
  );

  router.get(
    `${prefix}/reports/proforma-invoices`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "EXPORT"),
    async (context) =>
      controller.proformaInvoiceList(context.req, getTenantAuth(context).userId),
  );

  router.get(
    `${prefix}/reports/dashboards/executive`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "EXPORT"),
    async (context) =>
      controller.dashboardExecutive(context.req, getTenantAuth(context).userId),
  );

  router.get(
    `${prefix}/reports/dashboards/finance`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "EXPORT"),
    async (context) =>
      controller.dashboardFinance(context.req, getTenantAuth(context).userId),
  );

  router.get(
    `${prefix}/reports/dashboards/pharmacy`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "EXPORT"),
    async (context) =>
      controller.dashboardPharmacy(context.req, getTenantAuth(context).userId),
  );

  router.get(
    `${prefix}/reports/dashboards/stock`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("RELATORIOS", "EXPORT"),
    async (context) =>
      controller.dashboardStock(context.req, getTenantAuth(context).userId),
  );

  const pharmacyReports: Array<{ path: string; reportKey: string }> = [
    { path: "products/catalog", reportKey: REPORT_KEYS.PRODUCTS_CATALOG },
    { path: "products/by-category", reportKey: REPORT_KEYS.PRODUCTS_BY_CATEGORY },
    { path: "products/by-supplier", reportKey: REPORT_KEYS.PRODUCTS_BY_SUPPLIER },
    { path: "products/by-substancia", reportKey: REPORT_KEYS.PRODUCTS_BY_SUBSTANCIA },
    { path: "products/no-stock", reportKey: REPORT_KEYS.PRODUCTS_NO_STOCK },
    { path: "products/below-min-stock", reportKey: REPORT_KEYS.PRODUCTS_BELOW_MIN_STOCK },
    { path: "products/near-expiry", reportKey: REPORT_KEYS.PRODUCTS_NEAR_EXPIRY },
    { path: "products/expired", reportKey: REPORT_KEYS.PRODUCTS_EXPIRED },
    { path: "products/controlled", reportKey: REPORT_KEYS.PRODUCTS_CONTROLLED },
    { path: "categories", reportKey: REPORT_KEYS.CATEGORIES },
    { path: "lots/active", reportKey: REPORT_KEYS.LOTS_ACTIVE },
    { path: "lots/expired", reportKey: REPORT_KEYS.LOTS_EXPIRED },
    { path: "fefo/overview", reportKey: REPORT_KEYS.FEFO_OVERVIEW },
    { path: "fefo/audit", reportKey: REPORT_KEYS.FEFO_AUDIT },
  ];

  for (const report of pharmacyReports) {
    router.get(
      `${prefix}/reports/pharmacy/${report.path}`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("RELATORIOS", "EXPORT"),
      async (context) =>
        controller.pharmacyReport(
          report.reportKey,
          context.req,
          getTenantAuth(context).userId,
        ),
    );
  }

  const stockReports: Array<{ path: string; reportKey: string; parametric?: boolean }> = [
    { path: "movements", reportKey: REPORT_KEYS.STOCK_MOVEMENTS },
    { path: "movements/entrada", reportKey: REPORT_KEYS.STOCK_MOVEMENTS_ENTRADA },
    { path: "movements/saida", reportKey: REPORT_KEYS.STOCK_MOVEMENTS_SAIDA },
    { path: "movements/ajuste", reportKey: REPORT_KEYS.STOCK_MOVEMENTS_AJUSTE },
    { path: "purchase-suggestions", reportKey: REPORT_KEYS.PURCHASE_SUGGESTIONS },
    { path: "inventories", reportKey: REPORT_KEYS.INVENTORIES },
    { path: "inventories/:inventarioId", reportKey: REPORT_KEYS.INVENTORY_DETAIL, parametric: true },
  ];

  for (const report of stockReports) {
    router.get(
      `${prefix}/reports/stock/${report.path}`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("RELATORIOS", "EXPORT"),
      async (context) =>
        report.parametric
          ? controller.stockReportWithParams(
              report.reportKey,
              context.req,
              context.params,
              getTenantAuth(context).userId,
            )
          : controller.stockReport(
              report.reportKey,
              context.req,
              getTenantAuth(context).userId,
            ),
    );
  }

  const financeReports: Array<{ path: string; reportKey: string }> = [
    { path: "cashflow", reportKey: REPORT_KEYS.FINANCE_CASHFLOW },
    { path: "expenses", reportKey: REPORT_KEYS.FINANCE_EXPENSES },
    { path: "accounts-receivable", reportKey: REPORT_KEYS.FINANCE_ACCOUNTS_RECEIVABLE },
    { path: "accounts-payable", reportKey: REPORT_KEYS.FINANCE_ACCOUNTS_PAYABLE },
  ];

  for (const report of financeReports) {
    router.get(
      `${prefix}/reports/finance/${report.path}`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("RELATORIOS", "EXPORT"),
      async (context) =>
        controller.financeReport(
          report.reportKey,
          context.req,
          getTenantAuth(context).userId,
        ),
    );
  }

  const regulatoryReports: Array<{ path: string; reportKey: string }> = [
    { path: "receitas", reportKey: REPORT_KEYS.REGULATORY_RECEITAS },
    { path: "livro-receitas", reportKey: REPORT_KEYS.REGULATORY_LIVRO_RECEITAS },
    { path: "livro-psicotropicos", reportKey: REPORT_KEYS.REGULATORY_LIVRO_PSICOTROPICOS },
    { path: "sanitario", reportKey: REPORT_KEYS.REGULATORY_SANITARIO },
  ];

  for (const report of regulatoryReports) {
    router.get(
      `${prefix}/reports/regulatory/${report.path}`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("RELATORIOS", "EXPORT"),
      async (context) =>
        controller.regulatoryReport(
          report.reportKey,
          context.req,
          getTenantAuth(context).userId,
        ),
    );
  }

  const auditReports: Array<{ path: string; reportKey: string }> = [
    { path: "dashboard", reportKey: REPORT_KEYS.AUDIT_DASHBOARD },
    { path: "logs", reportKey: REPORT_KEYS.AUDIT_LOGS },
    { path: "timeline", reportKey: REPORT_KEYS.AUDIT_TIMELINE },
    { path: "business-events", reportKey: REPORT_KEYS.AUDIT_BUSINESS_EVENTS },
    { path: "psychotropics", reportKey: REPORT_KEYS.AUDIT_PSYCHOTROPICS },
    { path: "stock", reportKey: REPORT_KEYS.AUDIT_STOCK },
    { path: "financial", reportKey: REPORT_KEYS.AUDIT_FINANCIAL },
  ];

  for (const report of auditReports) {
    router.get(
      `${prefix}/reports/audit/${report.path}`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("RELATORIOS", "EXPORT"),
      async (context) =>
        controller.auditReport(
          report.reportKey,
          context.req,
          getTenantAuth(context).userId,
        ),
    );
  }

  const adminReports: Array<{ path: string; reportKey: string }> = [
    { path: "users", reportKey: REPORT_KEYS.ADMIN_USERS },
    { path: "sessions", reportKey: REPORT_KEYS.ADMIN_SESSIONS },
    { path: "last-access", reportKey: REPORT_KEYS.ADMIN_LAST_ACCESS },
    { path: "login-history", reportKey: REPORT_KEYS.ADMIN_LOGIN_HISTORY },
    { path: "user-activity", reportKey: REPORT_KEYS.ADMIN_USER_ACTIVITY },
    { path: "access-audit", reportKey: REPORT_KEYS.ADMIN_ACCESS_AUDIT },
    { path: "permissions-matrix", reportKey: REPORT_KEYS.ADMIN_PERMISSIONS_MATRIX },
    { path: "roles", reportKey: REPORT_KEYS.ADMIN_ROLES },
  ];

  for (const report of adminReports) {
    router.get(
      `${prefix}/reports/admin/${report.path}`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("RELATORIOS", "EXPORT"),
      async (context) =>
        controller.adminReport(
          report.reportKey,
          context.req,
          getTenantAuth(context).userId,
        ),
    );
  }
}
