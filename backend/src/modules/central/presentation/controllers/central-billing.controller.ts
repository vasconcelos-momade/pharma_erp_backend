import { z } from "zod";
import { GetTenantSubscriptionUseCase } from "../../billing/application/use-cases/get-tenant-subscription.use-case";
import { ListTenantInvoicesUseCase } from "../../billing/application/use-cases/list-tenant-invoices.use-case";
import { GetInvoiceUseCase } from "../../billing/application/use-cases/get-invoice.use-case";
import { ListTenantPaymentsUseCase } from "../../billing/application/use-cases/list-tenant-payments.use-case";
import { SubmitPaymentUseCase } from "../../billing/application/use-cases/submit-payment.use-case";
import { ConfirmPaymentUseCase } from "../../billing/application/use-cases/confirm-payment.use-case";
import { GenerateMonthlyBillingService } from "../../billing/application/services/generate-monthly-billing.service";
import { generateCentralInvoicePdf } from "../../billing/application/services/generate-invoice-pdf.service";
import { ProcessSubscriptionLifecycleService } from "../../billing/application/services/process-subscription-lifecycle.service";
import { JobQueueService } from "../../../../infrastructure/queue/job-queue.service";
import { serializeForJson } from "../../../../shared/http/serialize-json";
import { parseJsonBody, parseSearchParams } from "../../../../shared/http/request-validation";

const submitPaymentSchema = z.object({
  invoiceId: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  method: z.string().trim().min(1),
  reference: z.string().trim().min(1),
  proofUrl: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
});

const lifecycleSchema = z.object({
  referenceDate: z.string().trim().min(1).optional(),
});

const generateMonthlySchema = z.object({
  referenceDate: z.string().trim().min(1).optional(),
  tenantId: z.string().trim().min(1).optional(),
  subscriptionId: z.string().trim().min(1).optional(),
  dueDays: z.coerce.number().int().positive().optional(),
  includeTrial: z.coerce.boolean().optional(),
  dryRun: z.coerce.boolean().optional(),
});

const listInvoicesQuerySchema = z.object({
  status: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const listPaymentsQuerySchema = z.object({
  status: z.string().trim().min(1).optional(),
  invoiceId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const generateMonthlyQuerySchema = z.object({
  referenceDate: z.string().trim().min(1).optional(),
  tenantId: z.string().trim().min(1).optional(),
  subscriptionId: z.string().trim().min(1).optional(),
  dueDays: z.coerce.number().int().positive().optional(),
  includeTrial: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  dryRun: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  async: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export class CentralBillingController {
  async getSubscription(tenantId: string): Promise<Response> {
    const useCase = new GetTenantSubscriptionUseCase();
    const subscription = await useCase.execute({ tenantId });
    return Response.json(serializeForJson(subscription));
  }

  async listInvoices(tenantId: string, url: URL): Promise<Response> {
    const { status, limit } = parseSearchParams(url, listInvoicesQuerySchema);

    const useCase = new ListTenantInvoicesUseCase();
    const invoices = await useCase.execute({ tenantId, status, limit });
    return Response.json(serializeForJson(invoices));
  }

  async getInvoice(tenantId: string, invoiceId: string): Promise<Response> {
    const useCase = new GetInvoiceUseCase();
    const invoice = await useCase.execute({ tenantId, invoiceId });
    return Response.json(serializeForJson(invoice));
  }

  async getInvoicePdf(tenantId: string, invoiceId: string): Promise<Response> {
    const pdf = await generateCentralInvoicePdf(tenantId, invoiceId);
    return new Response(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="fatura-${invoiceId}.pdf"`,
      },
    });
  }

  async listPayments(tenantId: string, url: URL): Promise<Response> {
    const { status, invoiceId, limit } = parseSearchParams(url, listPaymentsQuerySchema);

    const useCase = new ListTenantPaymentsUseCase();
    const payments = await useCase.execute({ tenantId, status, invoiceId, limit });
    return Response.json(serializeForJson(payments));
  }

  async submitPayment(tenantId: string, req: Request, userId: string): Promise<Response> {
    const body = await parseJsonBody(req, submitPaymentSchema);

    const useCase = new SubmitPaymentUseCase();
    const payment = await useCase.execute({
      tenantId,
      invoiceId: body.invoiceId,
      amount: body.amount,
      method: body.method,
      reference: body.reference,
      proofUrl: body.proofUrl,
      notes: body.notes,
      createdByUserId: userId,
    });

    return Response.json(serializeForJson(payment), { status: 201 });
  }

  async confirmPayment(
    tenantId: string,
    paymentId: string,
    userId: string,
  ): Promise<Response> {
    const useCase = new ConfirmPaymentUseCase();
    const result = await useCase.execute({
      tenantId,
      paymentId,
      confirmedByUserId: userId,
    });
    return Response.json(serializeForJson(result));
  }

  async processLifecycle(req: Request): Promise<Response> {
    const body = lifecycleSchema.parse(await this.parseOptionalJson(req));

    const service = new ProcessSubscriptionLifecycleService();
    const result = await service.execute({
      referenceDate:
        body.referenceDate != null
          ? String(body.referenceDate)
          : undefined,
    });

    return Response.json(serializeForJson(result));
  }

  async generateMonthly(req: Request, url: URL): Promise<Response> {
    const body = generateMonthlySchema.parse(await this.parseOptionalJson(req));
    const query = parseSearchParams(url, generateMonthlyQuerySchema);

    const payload = {
      referenceDate:
        body.referenceDate != null
          ? String(body.referenceDate)
          : query.referenceDate,
      tenantId:
        body.tenantId != null
          ? String(body.tenantId)
          : query.tenantId,
      subscriptionId:
        body.subscriptionId != null
          ? String(body.subscriptionId)
          : query.subscriptionId,
      dueDays:
        body.dueDays != null
          ? Number(body.dueDays)
          : query.dueDays,
      includeTrial: body.includeTrial === true || query.includeTrial === true,
      dryRun: body.dryRun === true || query.dryRun === true,
    };

    if (query.async === true) {
      const queue = new JobQueueService();
      const job = await queue.enqueue("billing.generate-monthly", payload);
      return Response.json(
        serializeForJson({
          status: "queued",
          jobId: job.id,
          type: job.type,
          queuedAt: job.createdAt,
        }),
        { status: 202 },
      );
    }

    const service = new GenerateMonthlyBillingService();
    const result = await service.execute(payload);
    return Response.json(serializeForJson(result));
  }

  private async parseOptionalJson(req: Request): Promise<Record<string, unknown>> {
    if (!req.headers.get("Content-Type")?.includes("application/json")) {
      return {};
    }
    try {
      const parsed = await req.json();
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
}
