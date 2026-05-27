import { Router } from "../../shared/http/router";
import { requestLifecycleMiddleware } from "../../shared/http/middlewares";
import { registerAdminRoutes } from "./admin.routes";
import { registerAuthRoutes } from "./auth.routes";
import { registerPosRoutes } from "./pos.routes";
import { registerProductRoutes } from "./products.routes";
import { registerSalesRoutes } from "./sales.routes";
import { registerStockRoutes } from "./stock.routes";
import { registerSyncRoutes } from "./sync.routes";

export const API_V1_PREFIX = "/api/v1";

export function buildV1Router(): Router {
  const router = new Router();
  router.use(requestLifecycleMiddleware);

  registerAuthRoutes(router, API_V1_PREFIX);
  registerAdminRoutes(router, API_V1_PREFIX);
  registerProductRoutes(router, API_V1_PREFIX);
  registerStockRoutes(router, API_V1_PREFIX);
  registerPosRoutes(router, API_V1_PREFIX);
  registerSalesRoutes(router, API_V1_PREFIX);
  registerSyncRoutes(router, API_V1_PREFIX);

  router.get(`${API_V1_PREFIX}/health`, async () => ({
    status: "ok",
    version: "v1",
    service: "pharma-erp-backend",
  }));

  return router;
}
