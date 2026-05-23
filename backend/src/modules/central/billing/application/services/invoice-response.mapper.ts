import { computeRemainingAmount } from "./invoice-financial-integrity.service";

/** Moeda padrão SaaS (schema central não persiste currency por linha). */
export const DEFAULT_INVOICE_CURRENCY = "MZN";

export function mapInvoiceFinancialFields(invoice: {
  amount: unknown;
  paidAmount: unknown;
}): {
  amount: number;
  paidAmount: number;
  remainingAmount: number;
} {
  const amount = Number(invoice.amount);
  const paidAmount = Number(invoice.paidAmount);
  return {
    amount,
    paidAmount,
    remainingAmount: computeRemainingAmount(amount, paidAmount),
  };
}
