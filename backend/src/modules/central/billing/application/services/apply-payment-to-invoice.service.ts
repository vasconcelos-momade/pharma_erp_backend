import {
  assertInvoiceAmounts,
  computeRemainingAmount,
  deriveInvoiceStatus,
} from "./invoice-financial-integrity.service";
import { mapInvoiceFinancialFields } from "./invoice-response.mapper";

export interface ApplyPaymentToInvoiceInput {
  tenantId: string;
  paymentId: bigint;
  confirmedByUserId?: string | null;
}

export interface ApplyPaymentToInvoiceResult {
  payment: {
    id: string;
    status: string;
    confirmedAt: Date;
  };
  invoice: {
    id: string;
    number: string;
    amount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    paidAt: Date | null;
  };
}

/**
 * Confirma um pagamento pendente e actualiza a fatura associada (transacção Prisma).
 */
export async function applyPaymentToInvoice(
  tx: any,
  input: ApplyPaymentToInvoiceInput,
): Promise<ApplyPaymentToInvoiceResult> {
  const payment = await tx.payment.findFirst({
    where: {
      id: input.paymentId,
      tenantId: BigInt(input.tenantId),
      deletedAt: null,
    },
    include: { invoice: true },
  });

  if (!payment) {
    throw new Error("Pagamento não encontrado.");
  }

  if (payment.status === "confirmado") {
    throw new Error("Pagamento já confirmado.");
  }

  if (payment.status === "cancelado" || payment.status === "falhado") {
    throw new Error(`Não é possível confirmar pagamento com status ${payment.status}.`);
  }

  if (!payment.invoice) {
    throw new Error("Pagamento sem fatura associada.");
  }

  const invoice = payment.invoice;
  const amount = Number(invoice.amount);
  const paidBefore = Number(invoice.paidAmount);
  const paymentAmount = Number(payment.amount);
  const paidAfter = Math.round((paidBefore + paymentAmount) * 100) / 100;

  assertInvoiceAmounts(amount, paidAfter);
  const status = deriveInvoiceStatus(amount, paidAfter, String(invoice.status));
  const confirmedAt = new Date();

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: "confirmado",
      confirmedAt,
      confirmedBy: input.confirmedByUserId ? BigInt(input.confirmedByUserId) : null,
      updatedBy: input.confirmedByUserId ? BigInt(input.confirmedByUserId) : null,
    },
  });

  const updatedInvoice = await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      paidAmount: paidAfter,
      remainingAmount: computeRemainingAmount(Number(invoice.amount), paidAfter),
      status,
      paidAt: status === "pago" ? confirmedAt : invoice.paidAt,
    },
    select: {
      id: true,
      number: true,
      amount: true,
      paidAmount: true,
      status: true,
      paidAt: true,
    },
  });

  if (status === "pago") {
    await tx.tenant.update({
      where: { id: BigInt(input.tenantId) },
      data: { status: "ativo" },
    });
  }

  const financials = mapInvoiceFinancialFields(updatedInvoice);

  return {
    payment: {
      id: payment.id.toString(),
      status: "confirmado",
      confirmedAt,
    },
    invoice: {
      id: updatedInvoice.id.toString(),
      number: updatedInvoice.number,
      ...financials,
      status: updatedInvoice.status,
      paidAt: updatedInvoice.paidAt,
    },
  };
}
