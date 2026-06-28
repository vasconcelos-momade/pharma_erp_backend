import { ListFaturasUseCase } from "../../../pos/application/use-cases/list-faturas.use-case";
import { formatCurrency, toText } from "../helpers/report-export.helper";
import { collectAllPages } from "../helpers/report-pagination.helper";
import { REPORT_KEYS } from "../constants/report-keys";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";

type InvoiceListFilters = {
  search?: string;
  clienteId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  terminalId?: string;
  userId?: string;
};

function parseInvoiceListFilters(url: URL): InvoiceListFilters {
  const query = url.searchParams;
  const search = query.get("search")?.trim() || query.get("q")?.trim() || undefined;
  const clienteId = query.get("clienteId")?.trim() || undefined;
  const status = query.get("status")?.trim() || undefined;
  const dateFrom = query.get("dateFrom")?.trim() || undefined;
  const dateTo = query.get("dateTo")?.trim() || undefined;
  const terminalId = query.get("terminalId")?.trim() || undefined;
  const userId = query.get("userId")?.trim() || undefined;

  return { search, clienteId, status, dateFrom, dateTo, terminalId, userId };
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

export async function buildInvoiceListReportDefinition(
  filters: InvoiceListFilters,
  reportName: string,
  fileBaseName: string,
): Promise<ModuleReportDefinition> {
  const listUseCase = new ListFaturasUseCase();
  const items = await collectAllPages((page) =>
    listUseCase.execute({
      page,
      pageSize: 100,
      search: filters.search,
      clienteId: filters.clienteId,
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      terminalId: filters.terminalId,
      userId: filters.userId,
    }),
  );

  const totalAmount = items.reduce(
    (sum, item) => sum + Number(item.total ?? 0),
    0,
  );

  return {
    fileBaseName,
    reportName,
    title: reportName,
    filters: {
      Pesquisa: filters.search ?? "-",
      Cliente: filters.clienteId ?? "-",
      Estado: filters.status ?? "-",
      De: filters.dateFrom ?? "-",
      Ate: filters.dateTo ?? "-",
      Terminal: filters.terminalId ?? "-",
      Operador: filters.userId ?? "-",
    },
    kpis: {
      "Total de faturas": items.length,
      "Valor total (MZN)": formatCurrency(totalAmount),
      Pagas: items.filter((item) => item.estado === "PAGA").length,
      Pendentes: items.filter((item) =>
        ["EMITIDA", "PARCIAL"].includes(String(item.estado)),
      ).length,
      Anuladas: items.filter((item) => item.estado === "ANULADA").length,
    },
    tables: [
      {
        title: "Faturas",
        columns: [
          "Numero",
          "Cliente",
          "Terminal",
          "Total",
          "Estado",
          "Itens",
          "Data",
        ],
        rows: items.map((item) => [
          toText(item.numero),
          toText(item.cliente?.nome, "Consumidor final"),
          toText(item.terminal?.codigo ?? item.terminal?.nome),
          formatCurrency(item.total),
          toText(item.estado),
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
      template: "invoices/list",
      orientation: "landscape",
      pageSize: "A4",
    },
  };
}

export class InvoiceListReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.INVOICE_LIST;

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseInvoiceListFilters(context.url);
    return buildInvoiceListReportDefinition(
      filters,
      "Relatorio de Faturas",
      "relatorio-faturas",
    );
  }
}

export class SalesHistoryReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.SALES_HISTORY;

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseInvoiceListFilters(context.url);
    return buildInvoiceListReportDefinition(
      filters,
      "Historico de Vendas",
      "historico-vendas",
    );
  }
}
