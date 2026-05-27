import { PaymentMethod } from "../../../../../infrastructure/prisma/central/generated/central";
import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { runWithCentralTenant } from "../../../../../shared/context/central-tenant-context";
import { applyPaymentToInvoice } from "../services/apply-payment-to-invoice.service";

export interface ProcessPaymentWebhookDTO {
  webhookId: string;
}

export interface ProcessPaymentWebhookResult {
  webhookId: string;
  processed: boolean;
  paymentId?: string;
  invoiceId?: string;
  status?: string;
  skippedReason?: string;
}

interface NormalizedWebhookPayload {
  tenantId: string;
  invoiceId?: string;
  providerEventId: string;
  reference: string;
  amount: number;
  method: PaymentMethod;
  providerTransactionId?: string;
  externalReference?: string;
  eventType: string;
  success: boolean;
}

const PROVIDER_METHOD: Record<string, PaymentMethod> = {
  MPESA: PaymentMethod.MPESA,
  EMOLA: PaymentMethod.EMOLA,
};

function parseMethod(provider: string, payload: Record<string, unknown>): PaymentMethod {
  const raw = payload.method ?? payload.paymentMethod ?? provider;
  const normalized = String(raw).trim().toUpperCase();
  if (PROVIDER_METHOD[normalized]) {
    return PROVIDER_METHOD[normalized];
  }
  if (provider.toUpperCase() === "MPESA") return PaymentMethod.MPESA;
  if (provider.toUpperCase() === "EMOLA") return PaymentMethod.EMOLA;
  return PaymentMethod.OTHER;
}

function normalizePayload(
  provider: string,
  payload: Record<string, unknown>,
  tenantIdFallback?: string | null,
): NormalizedWebhookPayload {
  const tenantId = String(payload.tenantId ?? tenantIdFallback ?? "").trim();
  if (!tenantId) {
    throw new Error("tenantId em falta no payload do webhook.");
  }

  const providerEventId = String(
    payload.providerEventId ?? payload.eventId ?? payload.id ?? "",
  ).trim();
  if (!providerEventId) {
    throw new Error("providerEventId em falta no payload do webhook.");
  }

  const reference = String(payload.reference ?? payload.transactionReference ?? "").trim();
  if (!reference) {
    throw new Error("reference em falta no payload do webhook.");
  }

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount inválido no payload do webhook.");
  }

  const statusRaw = String(payload.status ?? payload.result ?? "success").toLowerCase();
  const success = ["success", "successful", "completed", "paid", "confirmado"].includes(statusRaw);

  return {
    tenantId,
    invoiceId: payload.invoiceId != null ? String(payload.invoiceId) : undefined,
    providerEventId,
    reference,
    amount,
    method: parseMethod(provider, payload),
    providerTransactionId:
      payload.providerTransactionId != null
        ? String(payload.providerTransactionId)
        : payload.transactionId != null
          ? String(payload.transactionId)
          : undefined,
    externalReference:
      payload.externalReference != null ? String(payload.externalReference) : undefined,
    eventType: String(payload.eventType ?? payload.type ?? "payment.notification"),
    success,
  };
}

export class ProcessPaymentWebhookUseCase {
  async execute(data: ProcessPaymentWebhookDTO): Promise<ProcessPaymentWebhookResult> {
    const prisma = prismaCentralUnscoped as any;

    const webhook = await prisma.paymentWebhook.findFirst({
      where: {
        id: BigInt(data.webhookId),
        deletedAt: null,
      },
    });

    if (!webhook) {
      throw new Error("Webhook não encontrado.");
    }

    if (webhook.processed) {
      return {
        webhookId: webhook.id.toString(),
        processed: true,
        skippedReason: "already_processed",
      };
    }

    const payload = webhook.payload as Record<string, unknown>;
    const normalized = normalizePayload(
      String(webhook.provider),
      payload,
      webhook.tenantId?.toString(),
    );

    return runWithCentralTenant(normalized.tenantId, async () => {
      return prisma.$transaction(async (tx: any) => {
        const existingByWebhook = await tx.payment.findFirst({
          where: {
            tenantId: BigInt(normalized.tenantId),
            webhookEventId: normalized.providerEventId,
            deletedAt: null,
          },
        });

        if (existingByWebhook?.status === "confirmado") {
          await tx.paymentWebhook.update({
            where: { id: webhook.id },
            data: { processed: true },
          });
          return {
            webhookId: webhook.id.toString(),
            processed: true,
            paymentId: existingByWebhook.id.toString(),
            skippedReason: "payment_already_confirmed",
          };
        }

        if (!normalized.success) {
          await tx.paymentWebhook.update({
            where: { id: webhook.id },
            data: { processed: true },
          });
          return {
            webhookId: webhook.id.toString(),
            processed: true,
            skippedReason: "payment_not_successful",
          };
        }

        let invoiceId = normalized.invoiceId;
        if (!invoiceId) {
          const openInvoice = await tx.invoice.findFirst({
            where: {
              tenantId: BigInt(normalized.tenantId),
              deletedAt: null,
              status: { in: ["pendente", "parcial", "vencido"] },
            },
            orderBy: { dueDate: "asc" },
          });
          invoiceId = openInvoice?.id?.toString();
        }

        if (!invoiceId) {
          throw new Error("Nenhuma fatura em aberto encontrada para aplicar o pagamento.");
        }

        const targetInvoice = await tx.invoice.findFirst({
          where: {
            id: BigInt(invoiceId),
            tenantId: BigInt(normalized.tenantId),
            deletedAt: null,
          },
        });

        if (!targetInvoice) {
          throw new Error("Fatura indicada no webhook não encontrada.");
        }

        if (targetInvoice.status === "pago" || targetInvoice.status === "cancelado") {
          await tx.paymentWebhook.update({
            where: { id: webhook.id },
            data: { processed: true },
          });
          return {
            webhookId: webhook.id.toString(),
            processed: true,
            skippedReason: "invoice_already_settled",
            invoiceId,
          };
        }

        const invoiceAmount = Number(targetInvoice.amount);
        const invoicePaid = Number(targetInvoice.paidAmount);
        const remaining = Math.round((invoiceAmount - invoicePaid) * 100) / 100;

        if (remaining <= 0) {
          await tx.paymentWebhook.update({
            where: { id: webhook.id },
            data: { processed: true },
          });
          return {
            webhookId: webhook.id.toString(),
            processed: true,
            skippedReason: "invoice_already_paid",
            invoiceId,
          };
        }

        const paymentAmount = Math.min(normalized.amount, remaining);

        let payment = existingByWebhook;

        if (!payment) {
          payment = await tx.payment.create({
            data: {
              tenantId: BigInt(normalized.tenantId),
              invoiceId: BigInt(invoiceId),
              amount: paymentAmount,
              method: normalized.method,
              reference: normalized.reference,
              providerTransactionId: normalized.providerTransactionId ?? null,
              externalReference: normalized.externalReference ?? null,
              webhookEventId: normalized.providerEventId,
              status: "pendente",
              notes: `Origem webhook ${webhook.provider}`,
            },
          });
        }

        const result = await applyPaymentToInvoice(tx, {
          tenantId: normalized.tenantId,
          paymentId: payment.id,
          confirmedByUserId: null,
        });

        await tx.paymentWebhook.update({
          where: { id: webhook.id },
          data: {
            processed: true,
            tenantId: BigInt(normalized.tenantId),
            reference: normalized.reference,
          },
        });

        return {
          webhookId: webhook.id.toString(),
          processed: true,
          paymentId: result.payment.id,
          invoiceId: result.invoice.id,
          status: result.invoice.status,
        };
      });
    });
  }
}
