/**
 * Integridade mínima fatura ↔ pagamentos.
 * remainingAmount é GENERATED no MySQL (amount - paidAmount) — nunca passar em create/update.
 */

export function assertInvoiceAmounts(amount: number, paidAmount: number): void {
  if (paidAmount < 0) {
    throw new Error("paidAmount não pode ser negativo.");
  }
  if (paidAmount > amount) {
    throw new Error("paidAmount não pode exceder o valor da fatura (amount).");
  }
}

export function computeRemainingAmount(amount: number, paidAmount: number): number {
  assertInvoiceAmounts(amount, paidAmount);
  return Math.round((amount - paidAmount) * 100) / 100;
}

export function deriveInvoiceStatus(
  amount: number,
  paidAmount: number,
  current: string,
): "pendente" | "parcial" | "pago" | "vencido" | "cancelado" {
  assertInvoiceAmounts(amount, paidAmount);
  if (current === "cancelado") {
    return "cancelado";
  }
  if (paidAmount <= 0) {
    return current === "vencido" ? "vencido" : "pendente";
  }
  if (paidAmount >= amount) return "pago";
  return "parcial";
}
