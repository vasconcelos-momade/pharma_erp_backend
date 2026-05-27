import { PaymentMethod } from "../../../../../infrastructure/prisma/central/generated/central";
import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { runWithCentralTenant } from "../../../../../shared/context/central-tenant-context";
import { DEFAULT_INVOICE_CURRENCY } from "../services/invoice-response.mapper";

export interface SubmitPaymentDTO {
  tenantId: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod | string;
  reference: string;
  proofUrl?: string;
  notes?: string;
  createdByUserId?: string;
}

const PAYMENT_METHODS = new Set<string>(Object.values(PaymentMethod));

function parsePaymentMethod(input: string): PaymentMethod {
  const normalized = input.trim().toUpperCase();
  if (!PAYMENT_METHODS.has(normalized)) {
    throw new Error(`Método de pagamento inválido: ${input}`);
  }
  return normalized as PaymentMethod;
}

export class SubmitPaymentUseCase {
  async execute(data: SubmitPaymentDTO) {
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new Error("amount deve ser um valor positivo.");
    }
    if (!data.reference?.trim()) {
      throw new Error("reference é obrigatório.");
    }

    return runWithCentralTenant(data.tenantId, async () => {
      const prisma = prismaCentralUnscoped as any;

      const invoice = await prisma.invoice.findFirst({
        where: {
          id: BigInt(data.invoiceId),
          tenantId: BigInt(data.tenantId),
          deletedAt: null,
        },
      });

      if (!invoice) {
        throw new Error("Fatura não encontrada.");
      }

      if (invoice.status === "pago" || invoice.status === "cancelado") {
        throw new Error(`Não é possível submeter pagamento para fatura com status ${invoice.status}.`);
      }

      const method = parsePaymentMethod(String(data.method));

      const payment = await prisma.payment.create({
        data: {
          tenantId: BigInt(data.tenantId),
          invoiceId: BigInt(data.invoiceId),
          amount: data.amount,
          method,
          reference: data.reference.trim(),
          proofUrl: data.proofUrl?.trim() || null,
          notes: data.notes?.trim() || null,
          status: "pendente",
          createdBy: data.createdByUserId ? BigInt(data.createdByUserId) : null,
        },
        select: {
          id: true,
          invoiceId: true,
          amount: true,
          method: true,
          status: true,
          reference: true,
          proofUrl: true,
          createdAt: true,
        },
      });

      return {
        id: payment.id.toString(),
        invoiceId: payment.invoiceId?.toString() ?? null,
        amount: payment.amount,
        currency: DEFAULT_INVOICE_CURRENCY,
        method: payment.method,
        status: payment.status,
        reference: payment.reference,
        proofUrl: payment.proofUrl,
        createdAt: payment.createdAt,
      };
    });
  }
}
