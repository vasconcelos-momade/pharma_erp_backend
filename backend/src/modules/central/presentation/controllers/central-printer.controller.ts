import {
  CancelPrintJobUseCase,
  CreatePrintJobUseCase,
  CreatePrinterUseCase,
  DeletePrinterUseCase,
  GetPrintJobUseCase,
  GetPrintJobPdfUseCase,
  GetPrinterUseCase,
  ListPrintJobsUseCase,
  ListPrintersUseCase,
  TestPrinterUseCase,
  UpdatePrinterUseCase,
  createPrintJobSchema,
  createPrinterSchema,
  listPrintJobsQuerySchema,
  listPrintersQuerySchema,
  printJobIdParamSchema,
  printerIdParamSchema,
  testPrinterSchema,
  updatePrinterSchema,
} from "../../printer";
import { controllerErrorResponse } from "../../../../shared/http/controller-error";
import {
  parseJsonBody,
  parseRouteParams,
  parseSearchParams,
} from "../../../../shared/http/request-validation";
import { serializeForJson } from "../../../../shared/http/serialize-json";
import type { RouteContext } from "../../../../shared/http/router";
import { getTenantAuth } from "../../../../shared/http/auth-middlewares";

export class CentralPrinterController {
  private auditUserId(auth: ReturnType<typeof getTenantAuth>) {
    return auth.centralUserId ?? auth.userId;
  }

  async list(context: RouteContext): Promise<Response> {
    try {
      const auth = getTenantAuth(context);
      const query = parseSearchParams(new URL(context.req.url), listPrintersQuerySchema);
      const result = await new ListPrintersUseCase().execute({
        tenantId: auth.tenantId,
        branchId: auth.branchId,
        query,
      });
      return Response.json(serializeForJson(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async get(context: RouteContext): Promise<Response> {
    try {
      const auth = getTenantAuth(context);
      const { id } = parseRouteParams(context.params, printerIdParamSchema);
      const result = await new GetPrinterUseCase().execute({
        tenantId: auth.tenantId,
        printerId: id,
      });
      return Response.json(serializeForJson(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error, 404);
    }
  }

  async create(context: RouteContext): Promise<Response> {
    try {
      const auth = getTenantAuth(context);
      const data = await parseJsonBody(context.req, createPrinterSchema);
      const branchId = data.branchId ?? auth.branchId;
      if (!branchId) {
        throw new Error("branchId é obrigatório (body ou header x-branch-id)");
      }
      const result = await new CreatePrinterUseCase().execute({
        tenantId: auth.tenantId,
        userId: this.auditUserId(auth),
        data: {
          ...data,
          branchId,
        },
      });
      return Response.json(serializeForJson(result), { status: 201 });
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async update(context: RouteContext): Promise<Response> {
    try {
      const auth = getTenantAuth(context);
      const { id } = parseRouteParams(context.params, printerIdParamSchema);
      const data = await parseJsonBody(context.req, updatePrinterSchema);
      const result = await new UpdatePrinterUseCase().execute({
        tenantId: auth.tenantId,
        printerId: id,
        userId: this.auditUserId(auth),
        data,
      });
      return Response.json(serializeForJson(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async delete(context: RouteContext): Promise<Response> {
    try {
      const auth = getTenantAuth(context);
      const { id } = parseRouteParams(context.params, printerIdParamSchema);
      const result = await new DeletePrinterUseCase().execute({
        tenantId: auth.tenantId,
        printerId: id,
        userId: this.auditUserId(auth),
      });
      return Response.json(serializeForJson(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error, 404);
    }
  }

  async test(context: RouteContext): Promise<Response> {
    try {
      const auth = getTenantAuth(context);
      const { id } = parseRouteParams(context.params, printerIdParamSchema);
      let data = {};
      try {
        data = await parseJsonBody(context.req, testPrinterSchema);
      } catch (error: unknown) {
        if (!(error instanceof SyntaxError)) throw error;
      }
      const result = await new TestPrinterUseCase().execute({
        tenantId: auth.tenantId,
        printerId: id,
        userId: this.auditUserId(auth),
        data,
      });
      return Response.json(serializeForJson(result), { status: 202 });
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async listJobs(context: RouteContext): Promise<Response> {
    try {
      const auth = getTenantAuth(context);
      const query = parseSearchParams(new URL(context.req.url), listPrintJobsQuerySchema);
      const result = await new ListPrintJobsUseCase().execute({
        tenantId: auth.tenantId,
        branchId: auth.branchId,
        query,
      });
      return Response.json(serializeForJson(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async getJob(context: RouteContext): Promise<Response> {
    try {
      const auth = getTenantAuth(context);
      const { id } = parseRouteParams(context.params, printJobIdParamSchema);
      const result = await new GetPrintJobUseCase().execute({
        tenantId: auth.tenantId,
        jobId: id,
      });
      return Response.json(serializeForJson(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error, 404);
    }
  }

  async createJob(context: RouteContext): Promise<Response> {
    try {
      const auth = getTenantAuth(context);
      const data = await parseJsonBody(context.req, createPrintJobSchema);
      const result = await new CreatePrintJobUseCase().execute({
        tenantId: auth.tenantId,
        branchId: auth.branchId,
        userId: this.auditUserId(auth),
        data,
      });
      return Response.json(serializeForJson(result), { status: 201 });
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async cancelJob(context: RouteContext): Promise<Response> {
    try {
      const auth = getTenantAuth(context);
      const { id } = parseRouteParams(context.params, printJobIdParamSchema);
      const result = await new CancelPrintJobUseCase().execute({
        tenantId: auth.tenantId,
        jobId: id,
        userId: this.auditUserId(auth),
      });
      return Response.json(serializeForJson(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async getJobPdf(context: RouteContext): Promise<Response> {
    try {
      const auth = getTenantAuth(context);
      const { id } = parseRouteParams(context.params, printJobIdParamSchema);
      const url = new URL(context.req.url);
      const asJson = url.searchParams.get("format") === "json";

      const result = await new GetPrintJobPdfUseCase().execute({
        tenantId: auth.tenantId,
        jobId: id,
      });

      if (asJson) {
        return Response.json(
          serializeForJson({
            jobId: result.jobId,
            document: result.document,
            fileName: result.fileName,
            contentType: result.contentType,
            base64: result.base64,
            regenerated: result.regenerated,
            driver: result.driver,
          }),
        );
      }

      return new Response(result.bytes, {
        status: 200,
        headers: {
          "Content-Type": result.contentType,
          "Content-Disposition": `inline; filename="${result.fileName}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (error: unknown) {
      return controllerErrorResponse(error, 404);
    }
  }
}
