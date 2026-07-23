import { CentralPrinterController } from "../../modules/central/presentation/controllers/central-printer.controller";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  requirePermission,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import type { RouteContext, Router } from "../../shared/http/router";

const controller = new CentralPrinterController();

type ConfigAction = "VIEW" | "CREATE" | "UPDATE" | "DELETE";

function registerPrinterPath(
  router: Router,
  method: "get" | "post" | "put" | "delete",
  path: string,
  action: ConfigAction,
  handler: (context: RouteContext) => Promise<Response>,
): void {
  if (action === "VIEW") {
    router[method](
      path,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("CONFIGURACOES", action),
      handler,
    );
    return;
  }

  router[method](
    path,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("CONFIGURACOES", action),
    auditMiddleware,
    handler,
  );
}

export function registerPrinterRoutes(router: Router, prefix: string): void {
  registerPrinterPath(router, "get", `${prefix}/central/printers`, "VIEW", (ctx) =>
    controller.list(ctx),
  );
  registerPrinterPath(router, "post", `${prefix}/central/printers`, "CREATE", (ctx) =>
    controller.create(ctx),
  );
  registerPrinterPath(router, "get", `${prefix}/central/printers/:id`, "VIEW", (ctx) =>
    controller.get(ctx),
  );
  registerPrinterPath(router, "put", `${prefix}/central/printers/:id`, "UPDATE", (ctx) =>
    controller.update(ctx),
  );
  registerPrinterPath(router, "delete", `${prefix}/central/printers/:id`, "DELETE", (ctx) =>
    controller.delete(ctx),
  );
  registerPrinterPath(router, "post", `${prefix}/central/printers/:id/test`, "UPDATE", (ctx) =>
    controller.test(ctx),
  );

  registerPrinterPath(router, "get", `${prefix}/central/print-jobs`, "VIEW", (ctx) =>
    controller.listJobs(ctx),
  );
  registerPrinterPath(router, "post", `${prefix}/central/print-jobs`, "CREATE", (ctx) =>
    controller.createJob(ctx),
  );
  registerPrinterPath(router, "get", `${prefix}/central/print-jobs/:id`, "VIEW", (ctx) =>
    controller.getJob(ctx),
  );
  registerPrinterPath(router, "get", `${prefix}/central/print-jobs/:id/pdf`, "VIEW", (ctx) =>
    controller.getJobPdf(ctx),
  );
  registerPrinterPath(router, "post", `${prefix}/central/print-jobs/:id/cancel`, "UPDATE", (ctx) =>
    controller.cancelJob(ctx),
  );
}
