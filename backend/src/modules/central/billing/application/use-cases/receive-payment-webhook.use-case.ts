import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { ProcessPaymentWebhookUseCase } from "./process-payment-webhook.use-case";

export interface ReceivePaymentWebhookDTO {
  provider: string;
  payload: Record<string, unknown>;
  tenantId?: string;
  processImmediately?: boolean;
}

export interface ReceivePaymentWebhookResult {
  webhookId: string;
  queued: boolean;
  processed?: boolean;
  paymentId?: string;
  invoiceId?: string;
  status?: string;
}

export class ReceivePaymentWebhookUseCase {
  async execute(data: ReceivePaymentWebhookDTO): Promise<ReceivePaymentWebhookResult> {
    const prisma = prismaCentralUnscoped as any;
    const provider = data.provider.trim().toUpperCase();

    const providerEventId = String(
      data.payload.providerEventId ?? data.payload.eventId ?? data.payload.id ?? "",
    ).trim();

    if (providerEventId) {
      const existing = await prisma.paymentWebhook.findFirst({
        where: { providerEventId, deletedAt: null },
      });
      if (existing) {
        if (data.processImmediately !== false && !existing.processed) {
          const processed = await new ProcessPaymentWebhookUseCase().execute({
            webhookId: existing.id.toString(),
          });
          return {
            webhookId: existing.id.toString(),
            queued: false,
            processed: processed.processed,
            paymentId: processed.paymentId,
            invoiceId: processed.invoiceId,
            status: processed.status,
          };
        }
        return { webhookId: existing.id.toString(), queued: !existing.processed };
      }
    }

    const tenantId =
      data.tenantId ??
      (data.payload.tenantId != null ? String(data.payload.tenantId) : undefined);

    const webhook = await prisma.paymentWebhook.create({
      data: {
        tenantId: tenantId ? BigInt(tenantId) : null,
        provider,
        eventType: String(data.payload.eventType ?? data.payload.type ?? "payment.notification"),
        providerEventId: providerEventId || null,
        reference:
          data.payload.reference != null ? String(data.payload.reference) : null,
        payload: data.payload,
        processed: false,
      },
    });

    if (data.processImmediately === false) {
      return { webhookId: webhook.id.toString(), queued: true };
    }

    const processed = await new ProcessPaymentWebhookUseCase().execute({
      webhookId: webhook.id.toString(),
    });

    return {
      webhookId: webhook.id.toString(),
      queued: false,
      processed: processed.processed,
      paymentId: processed.paymentId,
      invoiceId: processed.invoiceId,
      status: processed.status,
    };
  }
}
