import { ProformaInvoiceController } from "../../modules/tenant/sales";
import { ReportsController } from "../../modules/tenant/reports";
import { REPORT_KEYS } from "../../modules/tenant/reports/application/constants/report-keys";
import {
  parseReportQuery,
  resolveReportDisposition,
} from "../../modules/tenant/reports/application/dto/report.dto";
import { controllerErrorResponse } from "../../shared/http/controller-error";
import {
  proformaInvoiceIdParamSchema,
  proformaInvoiceItemIdParamSchema,
} from "../../modules/tenant/sales/application/dto/proforma-invoice.dto";
import {
  getTenantAuth,
  requirePermission,
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import { parseRouteParams } from "../../shared/http/request-validation";
import type { Router } from "../../shared/http/router";

const controller = new ProformaInvoiceController();
const reportsController = new ReportsController();
function registerResourceRoutes(router: Router, basePath: string): void {
  router.get(
    basePath,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PROFORMA_INVOICES", "VIEW"),
    async (context) => controller.search(context.req),
  );

  router.post(
    basePath,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PROFORMA_INVOICES", "CREATE"),
    auditMiddleware,
    async (context) =>
      controller.create(context.req, getTenantAuth(context).userId),
  );

  router.get(
    `${basePath}/:proformaInvoiceId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PROFORMA_INVOICES", "VIEW"),
    async (context) => {
      const { proformaInvoiceId } = parseRouteParams(context.params, proformaInvoiceIdParamSchema);
      return controller.get(proformaInvoiceId);
    },
  );

  router.put(
    `${basePath}/:proformaInvoiceId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PROFORMA_INVOICES", "UPDATE"),
    auditMiddleware,
    async (context) => {
      const { proformaInvoiceId } = parseRouteParams(context.params, proformaInvoiceIdParamSchema);
      return controller.update(
        proformaInvoiceId,
        context.req,
        getTenantAuth(context).userId,
      );
    },
  );

  router.post(
    `${basePath}/:proformaInvoiceId/itens`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PROFORMA_INVOICES", "UPDATE"),
    auditMiddleware,
    async (context) => {
      const { proformaInvoiceId } = parseRouteParams(context.params, proformaInvoiceIdParamSchema);
      return controller.addItem(
        proformaInvoiceId,
        context.req,
        getTenantAuth(context).userId,
      );
    },
  );

  router.put(
    `${basePath}/:proformaInvoiceId/itens/:itemId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PROFORMA_INVOICES", "UPDATE"),
    auditMiddleware,
    async (context) => {
      const { proformaInvoiceId, itemId } = parseRouteParams(
        context.params,
        proformaInvoiceItemIdParamSchema,
      );
      return controller.updateItem(
        proformaInvoiceId,
        itemId,
        context.req,
        getTenantAuth(context).userId,
      );
    },
  );

  router.delete(
    `${basePath}/:proformaInvoiceId/itens/:itemId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PROFORMA_INVOICES", "UPDATE"),
    auditMiddleware,
    async (context) => {
      const { proformaInvoiceId, itemId } = parseRouteParams(
        context.params,
        proformaInvoiceItemIdParamSchema,
      );
      return controller.removeItem(
        proformaInvoiceId,
        itemId,
        getTenantAuth(context).userId,
      );
    },
  );

  router.delete(
    `${basePath}/:proformaInvoiceId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PROFORMA_INVOICES", "DELETE"),
    auditMiddleware,
    async (context) => {
      const { proformaInvoiceId } = parseRouteParams(context.params, proformaInvoiceIdParamSchema);
      return controller.delete(proformaInvoiceId, getTenantAuth(context).userId);
    },
  );

  router.post(
    `${basePath}/:proformaInvoiceId/aprovar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PROFORMA_INVOICES", "APPROVE"),
    auditMiddleware,
    async (context) => {
      const { proformaInvoiceId } = parseRouteParams(context.params, proformaInvoiceIdParamSchema);
      return controller.approve(
        proformaInvoiceId,
        context.req,
        getTenantAuth(context).userId,
      );
    },
  );

  router.post(
    `${basePath}/:proformaInvoiceId/rejeitar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PROFORMA_INVOICES", "REJECT"),
    auditMiddleware,
    async (context) => {
      const { proformaInvoiceId } = parseRouteParams(context.params, proformaInvoiceIdParamSchema);
      return controller.reject(
        proformaInvoiceId,
        context.req,
        getTenantAuth(context).userId,
      );
    },
  );

  router.post(
    `${basePath}/:proformaInvoiceId/expirar`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PROFORMA_INVOICES", "UPDATE"),
    auditMiddleware,
    async (context) => {
      const { proformaInvoiceId } = parseRouteParams(context.params, proformaInvoiceIdParamSchema);
      return controller.expire(
        proformaInvoiceId,
        context.req,
        getTenantAuth(context).userId,
      );
    },
  );

  router.get(
    `${basePath}/:proformaInvoiceId/auditoria`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("PROFORMA_INVOICES", "VIEW"),
    async (context) => {
      const { proformaInvoiceId } = parseRouteParams(context.params, proformaInvoiceIdParamSchema);
      return controller.listAudit(context.req, proformaInvoiceId);
    },
  );

  const registerProformaPdfRoute = (pdfPath: string) =>
    router.get(
      pdfPath,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("PROFORMA_INVOICES", "EXPORT"),
      async (context) => {
        try {
          const { proformaInvoiceId } = parseRouteParams(context.params, proformaInvoiceIdParamSchema);
          const url = new URL(context.req.url);
          const query = parseReportQuery(url);
          const format = query.format ?? "pdf";
          const artifact = await reportsController.generateArtifact({
            reportKey: REPORT_KEYS.PROFORMA_INVOICE,
            userId: getTenantAuth(context).userId,
            routeParams: { proformaInvoiceId },
            url,
            format,
            disposition: resolveReportDisposition(format, query.disposition),
          });
          const fileName = artifact.fileName.replace(
            /^proformaInvoice-/i,
            "fatura-proforma-",
          );
          const body = new Blob([artifact.bytes as BlobPart], {
            type: artifact.contentType,
          });
          return new Response(body, {
            headers: {
              "Content-Type": artifact.contentType,
              "Content-Disposition": `attachment; filename="${fileName}"`,
            },
          });
        } catch (error: any) {
          return controllerErrorResponse(error);
        }
      },
    );

  registerProformaPdfRoute(`${basePath}/:proformaInvoiceId/proforma/pdf`);
  registerProformaPdfRoute(`${basePath}/:proformaInvoiceId/pdf`);
}

export function registerProformaInvoiceRoutes(router: Router, prefix: string): void {
  registerResourceRoutes(router, `${prefix}/tenant/proforma-invoices`);
}
