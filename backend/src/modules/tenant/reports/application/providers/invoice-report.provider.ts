import { ValidationApiError } from "../../../../../shared/http/api-error";
import { GetFaturaDetalheUseCase } from "../../../pos/application/use-cases/get-fatura-detalhe.use-case";
import { formatCurrency, toText } from "../helpers/report-export.helper";
import { REPORT_KEYS } from "../constants/report-keys";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";

export class InvoiceReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.INVOICE;

  private readonly detailUseCase = new GetFaturaDetalheUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const invoiceId = context.routeParams.faturaId;
    if (!/^\d+$/.test(invoiceId ?? "")) {
      throw new ValidationApiError("faturaId invalido");
    }

    const invoice = await this.detailUseCase.execute(invoiceId);
    return {
      fileBaseName: `fatura-${toText(invoice.numero, invoiceId)}`,
      reportName: `Fatura ${toText(invoice.numero, invoiceId)}`,
      filters: {
        Numero: invoice.numero,
        Serie: invoice.serie,
        Estado: invoice.estado,
        Cliente: invoice.cliente?.nome ?? "Consumidor final",
      },
      kpis: {
        Itens: invoice.summary?.itemCount ?? 0,
        Pagamentos: invoice.summary?.paymentCount ?? 0,
        "Subtotal (MZN)": formatCurrency(invoice.subtotal),
        "IVA (MZN)": formatCurrency(invoice.ivaTotal),
        "Total (MZN)": formatCurrency(invoice.total),
      },
      tables: [
        {
          title: "Itens da fatura",
          columns: ["Descricao", "Qtd", "Preco Unit.", "IVA", "Total"],
          rows: (invoice.items ?? []).map((item: any) => [
            item.descricao,
            item.quantidade,
            formatCurrency(item.precoUnit),
            formatCurrency(item.valorIva),
            formatCurrency(item.total),
          ]),
        },
        {
          title: "Pagamentos",
          columns: ["Metodo", "Valor", "Referencia", "Estado"],
          rows: (invoice.payments ?? []).map((payment: any) => [
            payment.metodo,
            formatCurrency(payment.valor),
            payment.referencia ?? "-",
            payment.status,
          ]),
        },
      ],
      totals: {
        Subtotal: formatCurrency(invoice.subtotal),
        Desconto: formatCurrency(invoice.desconto),
        IVA: formatCurrency(invoice.ivaTotal),
        Total: formatCurrency(invoice.total),
        "Valor recebido": formatCurrency(invoice.valorRecebido),
        Troco: formatCurrency(invoice.troco),
      },
      observations: [
        `Terminal: ${toText(invoice.terminal?.codigo ?? invoice.terminal?.nome)}`,
        `Operador: ${toText(invoice.user?.name)}`,
      ],
      pdf: {
        template: "invoices/detail",
        orientation: "portrait",
        pageSize: "A4",
      },
    };
  }
}
