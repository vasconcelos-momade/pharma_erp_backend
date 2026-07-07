import { z } from "zod";
import { CentralBranchController } from "../../modules/central/presentation/controllers/central-branch.controller";
import { CentralBillingController } from "../../modules/central/presentation/controllers/central-billing.controller";
import { CentralTenantController } from "../../modules/central/presentation/controllers/central-tenant.controller";
import { CentralWebhookController } from "../../modules/central/presentation/controllers/central-webhook.controller";
import {
  centralAuthMiddleware,
  getCentralAuth,
  getOptionalCentralAuth,
  getRawBody,
  optionalCentralAuthMiddleware,
  superadminMiddleware,
  tenantAccessMiddleware,
  webhookSignatureMiddleware,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware, createRateLimitMiddleware } from "../../shared/http/middlewares";
import { parseRouteParams } from "../../shared/http/request-validation";
import type { Router } from "../../shared/http/router";

const branchController = new CentralBranchController();
const billingController = new CentralBillingController();
const tenantController = new CentralTenantController();
const webhookController = new CentralWebhookController();

const tenantIdParamSchema = z.object({
  tenantId: z.string().regex(/^\d+$/, "tenantId inválido"),
});

const tenantInvoiceParamSchema = tenantIdParamSchema.extend({
  invoiceId: z.string().regex(/^\d+$/, "invoiceId inválido"),
});

const tenantPaymentParamSchema = tenantIdParamSchema.extend({
  paymentId: z.string().regex(/^\d+$/, "paymentId inválido"),
});

const webhookProviderParamSchema = z.object({
  provider: z.enum(["mpesa", "emola"]),
});

const webhookProcessParamSchema = z.object({
  webhookId: z.string().regex(/^\d+$/, "webhookId inválido"),
});

export function registerAdminRoutes(router: Router, prefix: string): void {
  router.get(
    `${prefix}/central/tenants`,
    centralAuthMiddleware(),
    async (context) => tenantController.list(getCentralAuth(context)),
  );

  router.post(
    `${prefix}/central/tenants`,
    optionalCentralAuthMiddleware(),
    createRateLimitMiddleware({ keyPrefix: "central-tenant-register", windowMs: 60_000, max: 10 }),
    auditMiddleware,
    async (context) => tenantController.register(context.req, context.url, getOptionalCentralAuth(context)),
  );

  router.get(
    `${prefix}/central/tenants/:tenantId`,
    centralAuthMiddleware(),
    tenantAccessMiddleware("tenantId"),
    async (context) => {
      const { tenantId } = parseRouteParams(context.params, tenantIdParamSchema);
      return tenantController.getById(getCentralAuth(context), tenantId);
    },
  );

  router.get(
    `${prefix}/central/tenants/:tenantId/branches`,
    centralAuthMiddleware(),
    tenantAccessMiddleware("tenantId"),
    async (context) => {
      const { tenantId } = parseRouteParams(context.params, tenantIdParamSchema);
      return branchController.list(tenantId, context.url);
    },
  );

  router.post(
    `${prefix}/central/tenants/:tenantId/branches`,
    centralAuthMiddleware(),
    tenantAccessMiddleware("tenantId"),
    auditMiddleware,
    async (context) => {
      const { tenantId } = parseRouteParams(context.params, tenantIdParamSchema);
      return branchController.create(tenantId, context.req);
    },
  );

  router.get(
    `${prefix}/central/tenants/:tenantId/subscription`,
    centralAuthMiddleware(),
    tenantAccessMiddleware("tenantId"),
    async (context) => {
      const { tenantId } = parseRouteParams(context.params, tenantIdParamSchema);
      return billingController.getSubscription(tenantId);
    },
  );

  router.get(
    `${prefix}/central/tenants/:tenantId/invoices`,
    centralAuthMiddleware(),
    tenantAccessMiddleware("tenantId"),
    async (context) => {
      const { tenantId } = parseRouteParams(context.params, tenantIdParamSchema);
      return billingController.listInvoices(tenantId, context.url);
    },
  );

  router.get(
    `${prefix}/central/tenants/:tenantId/invoices/:invoiceId`,
    centralAuthMiddleware(),
    tenantAccessMiddleware("tenantId"),
    async (context) => {
      const { tenantId, invoiceId } = parseRouteParams(context.params, tenantInvoiceParamSchema);
      return billingController.getInvoice(tenantId, invoiceId);
    },
  );

  router.get(
    `${prefix}/central/tenants/:tenantId/invoices/:invoiceId/pdf`,
    centralAuthMiddleware(),
    tenantAccessMiddleware("tenantId"),
    async (context) => {
      const { tenantId, invoiceId } = parseRouteParams(context.params, tenantInvoiceParamSchema);
      return billingController.getInvoicePdf(tenantId, invoiceId);
    },
  );

  router.get(
    `${prefix}/central/tenants/:tenantId/payments`,
    centralAuthMiddleware(),
    tenantAccessMiddleware("tenantId"),
    async (context) => {
      const { tenantId } = parseRouteParams(context.params, tenantIdParamSchema);
      return billingController.listPayments(tenantId, context.url);
    },
  );

  router.post(
    `${prefix}/central/tenants/:tenantId/payments`,
    centralAuthMiddleware(),
    tenantAccessMiddleware("tenantId"),
    auditMiddleware,
    async (context) => {
      const { tenantId } = parseRouteParams(context.params, tenantIdParamSchema);
      return billingController.submitPayment(tenantId, context.req, getCentralAuth(context).userId);
    },
  );

  router.post(
    `${prefix}/central/tenants/:tenantId/payments/:paymentId/confirm`,
    centralAuthMiddleware(),
    tenantAccessMiddleware("tenantId"),
    superadminMiddleware(),
    auditMiddleware,
    async (context) => {
      const { tenantId, paymentId } = parseRouteParams(context.params, tenantPaymentParamSchema);
      return billingController.confirmPayment(tenantId, paymentId, getCentralAuth(context).userId);
    },
  );

  router.post(
    `${prefix}/central/billing/process-lifecycle`,
    centralAuthMiddleware(),
    superadminMiddleware(),
    auditMiddleware,
    async (context) => billingController.processLifecycle(context.req),
  );

  router.post(
    `${prefix}/central/billing/generate-monthly`,
    centralAuthMiddleware(),
    superadminMiddleware(),
    auditMiddleware,
    async (context) => billingController.generateMonthly(context.req, context.url),
  );

  router.post(
    `${prefix}/central/webhooks/:provider`,
    webhookSignatureMiddleware("provider"),
    createRateLimitMiddleware({ keyPrefix: "central-webhook", windowMs: 60_000, max: 120 }),
    auditMiddleware,
    async (context) => {
      const { provider } = parseRouteParams(context.params, webhookProviderParamSchema);
      return webhookController.receive(provider, context.req, getRawBody(context));
    },
  );

  router.post(
    `${prefix}/central/webhooks/events/:webhookId/process`,
    centralAuthMiddleware(),
    superadminMiddleware(),
    auditMiddleware,
    async (context) => {
      const { webhookId } = parseRouteParams(context.params, webhookProcessParamSchema);
      return webhookController.processPending(webhookId);
    },
  );
}
