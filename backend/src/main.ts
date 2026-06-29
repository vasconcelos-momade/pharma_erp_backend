/// <reference lib="dom" />
import { buildV1Router } from "./routes/v1";
import { validateReportRegistry } from "./modules/tenant/reports/application/validation/report-registry.validator";
import { ApiError, NotFoundApiError } from "./shared/http/api-error";
import { globalErrorHandler } from "./shared/http/error-handler";
import { createPreflightResponse, requestLifecycleMiddleware } from "./shared/http/middlewares";
import { Router } from "./shared/http/router";

validateReportRegistry();

const v1Router = buildV1Router();
const v2Router = new Router();

v2Router.use(requestLifecycleMiddleware);
v2Router.get("/api/v2/health", async () => ({
  status: "planned",
  version: "v2",
  message: "Versão reservada para evolução futura da API.",
}));

const httpIdleTimeoutSeconds = Number(process.env.HTTP_IDLE_TIMEOUT_SECONDS ?? 120);
const serverIdleTimeout =
  Number.isFinite(httpIdleTimeoutSeconds) && httpIdleTimeoutSeconds > 0
    ? httpIdleTimeoutSeconds
    : 120;

const server = Bun.serve({
  port: 3300,
  idleTimeout: serverIdleTimeout,
  async fetch(req: Request) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      try {
        return createPreflightResponse(req);
      } catch (error) {
        return globalErrorHandler(error);
      }
    }

    try {
      const v1Response = await v1Router.handle(req, url);
      if (v1Response) {
        return v1Response;
      }

      const v2Response = await v2Router.handle(req, url);
      if (v2Response) {
        return v2Response;
      }

      if (url.pathname.startsWith("/api/v2")) {
        return globalErrorHandler(
          new ApiError(
            "Versão da API reservada para evolução futura. Utilize /api/v1 por enquanto.",
            501,
            "API_VERSION_NOT_IMPLEMENTED",
          ),
        );
      }

      if (url.pathname === "/") {
        return Response.json({
          service: "Pharma ERP Backend",
          apiBasePath: "/api/v1",
          healthcheck: "/api/v1/health",
        });
      }

      return globalErrorHandler(new NotFoundApiError("Rota não encontrada"));
    } catch (error) {
      return globalErrorHandler(error);
    }
  },
});

console.log(`Server running at http://localhost:${server.port}`);
