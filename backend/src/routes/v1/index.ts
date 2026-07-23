import { Router } from "../../shared/http/router";
import { requestLifecycleMiddleware } from "../../shared/http/middlewares";
import { registerAdminRoutes } from "./admin.routes";
import { registerAuthRoutes } from "./auth.routes";
import { registerPosRoutes } from "./pos.routes";
import { registerProductRoutes } from "./products.routes";
import { registerSalesRoutes } from "./sales.routes";
import { registerStockRoutes } from "./stock.routes";
import { registerDashboardRoutes } from "./dashboard.routes";
import { registerRegulatoryRoutes } from "./regulatory.routes";
import { registerSyncRoutes } from "./sync.routes";
import { registerClientesRoutes } from "./clientes.routes";
import { registerFaturasRoutes } from "./faturas.routes";
import { registerUsersRoutes } from "./users.routes";
import { registerAuditRoutes } from "./audit.routes";
import { registerReportsRoutes } from "./reports.routes";
import { registerProformaInvoiceRoutes } from "./proforma-invoices.routes";
import { registerSettingsRoutes } from "./settings.routes";
import { registerFinanceRoutes } from "./finance.routes";
import { registerPrinterRoutes } from "./printers.routes";

export const API_V1_PREFIX = "/api/v1";

export function buildV1Router(): Router {
  const router = new Router();
  router.use(requestLifecycleMiddleware);

  registerAuthRoutes(router, API_V1_PREFIX);
  registerAdminRoutes(router, API_V1_PREFIX);
  registerProductRoutes(router, API_V1_PREFIX);
  registerStockRoutes(router, API_V1_PREFIX);
  registerDashboardRoutes(router, API_V1_PREFIX);
  registerRegulatoryRoutes(router, API_V1_PREFIX);
  registerPosRoutes(router, API_V1_PREFIX);
  registerSalesRoutes(router, API_V1_PREFIX);
  registerClientesRoutes(router, API_V1_PREFIX);
  registerFaturasRoutes(router, API_V1_PREFIX);
  registerUsersRoutes(router, API_V1_PREFIX);
  registerAuditRoutes(router, API_V1_PREFIX);
  registerReportsRoutes(router, API_V1_PREFIX);
  registerProformaInvoiceRoutes(router, API_V1_PREFIX);
  registerSyncRoutes(router, API_V1_PREFIX);
  registerSettingsRoutes(router, API_V1_PREFIX);
  registerFinanceRoutes(router, API_V1_PREFIX);
  registerPrinterRoutes(router, API_V1_PREFIX);

  router.get(`${API_V1_PREFIX}/health`, async () => ({
    status: "ok",
    version: "v1",
    service: "pharma-erp-backend",
  }));

  return router;
}
