import { buildSimplePdfFromLines } from "../../../../tenant/reports/application/templates/pdf-html.converter";
import { GetInvoiceUseCase } from "../use-cases/get-invoice.use-case";

function toLine(label: string, value: unknown): string {
  const normalized = String(value ?? "").trim();
  return `${label}: ${normalized || "—"}`;
}

export async function generateCentralInvoicePdf(
  tenantId: string,
  invoiceId: string,
): Promise<Uint8Array> {
  const useCase = new GetInvoiceUseCase();
  const invoice = await useCase.execute({ tenantId, invoiceId });

  const lines = [
    "Pharma ERP SaaS - Fatura",
    toLine("Empresa", invoice.tenant?.companyName),
    toLine("NUIT", invoice.tenant?.nuit),
    toLine("Contacto", invoice.tenant?.contact),
    toLine("Endereco", invoice.tenant?.address),
    "",
    `Numero: ${invoice.number}`,
    `Estado: ${invoice.status}`,
    `Valor total: ${invoice.amount} ${invoice.currency}`,
    `Pago: ${invoice.paidAmount} ${invoice.currency}`,
    `Remanescente: ${invoice.remainingAmount} ${invoice.currency}`,
    `Vencimento: ${invoice.dueDate ?? "—"}`,
    `Periodo: ${invoice.periodStart ?? "—"} a ${invoice.periodEnd ?? "—"}`,
    `Filiais: ${invoice.branchesUsed ?? 0} (+${invoice.extraBranches ?? 0} extra)`,
    invoice.description ? `Descricao: ${invoice.description}` : "",
    "",
    "Pagamentos:",
    ...(invoice.payments?.length
      ? invoice.payments.map(
          (p: any) =>
            `- ${p.reference} | ${p.amount} | ${p.status} | ${p.method}`,
        )
      : ["(nenhum)"]),
  ].filter(Boolean);

  return buildSimplePdfFromLines(lines);
}
