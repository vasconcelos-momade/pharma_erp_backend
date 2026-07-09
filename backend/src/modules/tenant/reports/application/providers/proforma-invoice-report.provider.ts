import { ValidationApiError } from "../../../../../shared/http/api-error";
import { ProformaInvoiceService } from "../../../sales/application/services/proforma-invoice.service";
import { formatCurrency, toText } from "../helpers/report-export.helper";
import { collectAllPages } from "../helpers/report-pagination.helper";
import { REPORT_KEYS } from "../constants/report-keys";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";

function parseProformaInvoiceListFilters(url: URL) {
  const query = url.searchParams;
  const search = query.get("q")?.trim() || query.get("search")?.trim() || undefined;
  const estadoRaw = query.get("estado")?.trim();
  const estado =
    estadoRaw === "PENDENTE" ||
    estadoRaw === "APROVADA" ||
    estadoRaw === "REJEITADA" ||
    estadoRaw === "EXPIRADA"
      ? estadoRaw
      : undefined;
  const clienteId = query.get("clienteId")?.trim() || undefined;
  const validadeFrom = query.get("validadeFrom")?.trim() || undefined;
  const validadeTo = query.get("validadeTo")?.trim() || undefined;
  const createdFrom = query.get("createdFrom")?.trim() || undefined;
  const createdTo = query.get("createdTo")?.trim() || undefined;

  return {
    query: search,
    estado,
    clienteId: clienteId ? BigInt(clienteId) : undefined,
    validadeFrom,
    validadeTo,
    createdFrom,
    createdTo,
  };
}

function formatDateTime(value: unknown): string {
  if (!value) {
    return "-";
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return toText(value);
  }
  return date.toISOString().replace("T", " ").slice(0, 16);
}

function buildProformaInvoiceDetailDefinition(proformaInvoice: any): ModuleReportDefinition {
  return {
    fileBaseName: `proforma-${toText(proformaInvoice.numero, proformaInvoice.id)}`,
    reportName: `Fatura Proforma ${toText(proformaInvoice.numero, proformaInvoice.id)}`,
    title: `Fatura Proforma ${toText(proformaInvoice.numero, proformaInvoice.id)}`,
    filters: {
      Numero: proformaInvoice.numero,
      Estado: proformaInvoice.estado,
      Cliente: proformaInvoice.cliente?.nome ?? "-",
      Validade: formatDateTime(proformaInvoice.validade),
      Moeda: proformaInvoice.moeda,
    },
    kpis: {
      Itens: proformaInvoice.itemCount ?? proformaInvoice.items?.length ?? 0,
      "Subtotal (MZN)": formatCurrency(proformaInvoice.subtotal),
      "IVA (MZN)": formatCurrency(proformaInvoice.ivaTotal),
      "Total (MZN)": formatCurrency(proformaInvoice.total),
    },
    tables: [
      {
        title: "Itens da fatura proforma",
        columns: ["Descricao", "Qtd", "Preco Unit.", "IVA", "Total"],
        rows: (proformaInvoice.items ?? []).map((item: any) => [
          item.descricao ?? item.produto?.nomeComercial ?? item.servico?.nome ?? "-",
          item.quantidade,
          formatCurrency(item.precoUnit),
          formatCurrency(item.valorIva ?? item.iva),
          formatCurrency(item.total),
        ]),
      },
    ],
    totals: {
      Subtotal: formatCurrency(proformaInvoice.subtotal),
      Desconto: formatCurrency(proformaInvoice.desconto),
      IVA: formatCurrency(proformaInvoice.ivaTotal),
      Total: formatCurrency(proformaInvoice.total),
    },
    observations: proformaInvoice.observacoes ? [toText(proformaInvoice.observacoes)] : [],
    pdf: {
      template: "proforma-invoices/detail",
      orientation: "portrait",
      pageSize: "A4",
    },
  };
}

export class ProformaInvoiceReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.PROFORMA_INVOICE;

  private readonly proformaInvoiceService = new ProformaInvoiceService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const proformaInvoiceId = context.routeParams.proformaInvoiceId;
    if (!/^\d+$/.test(proformaInvoiceId ?? "")) {
      throw new ValidationApiError("proformaInvoiceId inválido");
    }

    const proformaInvoice = this.proformaInvoiceService.enrichProformaInvoice(
      await this.proformaInvoiceService.get(proformaInvoiceId),
    );
    return buildProformaInvoiceDetailDefinition(proformaInvoice);
  }
}

export class ProformaInvoiceListReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.PROFORMA_INVOICE_LIST;

  private readonly proformaInvoiceService = new ProformaInvoiceService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseProformaInvoiceListFilters(context.url);
    const items = await collectAllPages((page) =>
      this.proformaInvoiceService.search({
        ...filters,
        page,
        pageSize: 100,
      }),
    );

    const totalAmount = items.reduce(
      (sum, item) => sum + Number(item.total ?? 0),
      0,
    );

    return {
      fileBaseName: "relatorio-proformas",
      reportName: "Relatorio de Faturas Proforma",
      title: "Relatorio de Faturas Proforma",
      filters: {
        Pesquisa: filters.query ?? "-",
        Estado: filters.estado ?? "-",
        Cliente: filters.clienteId?.toString() ?? "-",
        "Validade de": filters.validadeFrom ?? "-",
        "Validade ate": filters.validadeTo ?? "-",
        "Criado de": filters.createdFrom ?? "-",
        "Criado ate": filters.createdTo ?? "-",
      },
      kpis: {
        "Total de faturas proforma": items.length,
        "Valor total (MZN)": formatCurrency(totalAmount),
        Pendentes: items.filter((item) => item.estado === "PENDENTE").length,
        Aprovadas: items.filter((item) => item.estado === "APROVADA").length,
      },
      tables: [
        {
          title: "Faturas Proforma",
          columns: [
            "Numero",
            "Cliente",
            "Estado",
            "Validade",
            "Total",
            "Itens",
            "Criado em",
          ],
          rows: items.map((item) => [
            toText(item.numero),
            toText(item.cliente?.nome),
            toText(item.estado),
            formatDateTime(item.validade),
            formatCurrency(item.total),
            toText(item.itemCount, "0"),
            formatDateTime(item.createdAt),
          ]),
        },
      ],
      totals: {
        Registos: items.length,
        "Valor total (MZN)": formatCurrency(totalAmount),
      },
      orientation: "landscape",
      pdf: {
        template: "proforma-invoices/list",
        orientation: "landscape",
        pageSize: "A4",
      },
    };
  }
}
