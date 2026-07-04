import { ValidationApiError } from "../../../../../shared/http/api-error";
import { CotacaoService } from "../../../sales/application/services/cotacao.service";
import { formatCurrency, toText } from "../helpers/report-export.helper";
import { collectAllPages } from "../helpers/report-pagination.helper";
import { REPORT_KEYS } from "../constants/report-keys";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";

function parseCotacaoListFilters(url: URL) {
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

function buildQuotationDetailDefinition(cotacao: any): ModuleReportDefinition {
  return {
    fileBaseName: `cotacao-${toText(cotacao.numero, cotacao.id)}`,
    reportName: `Cotacao ${toText(cotacao.numero, cotacao.id)}`,
    title: `Cotacao ${toText(cotacao.numero, cotacao.id)}`,
    filters: {
      Numero: cotacao.numero,
      Estado: cotacao.estado,
      Cliente: cotacao.cliente?.nome ?? "-",
      Validade: formatDateTime(cotacao.validade),
      Moeda: cotacao.moeda,
    },
    kpis: {
      Itens: cotacao.itemCount ?? cotacao.items?.length ?? 0,
      "Subtotal (MZN)": formatCurrency(cotacao.subtotal),
      "IVA (MZN)": formatCurrency(cotacao.ivaTotal),
      "Total (MZN)": formatCurrency(cotacao.total),
    },
    tables: [
      {
        title: "Itens da cotacao",
        columns: ["Descricao", "Qtd", "Preco Unit.", "IVA", "Total"],
        rows: (cotacao.items ?? []).map((item: any) => [
          item.descricao ?? item.produto?.nomeComercial ?? item.servico?.nome ?? "-",
          item.quantidade,
          formatCurrency(item.precoUnit),
          formatCurrency(item.valorIva ?? item.iva),
          formatCurrency(item.total),
        ]),
      },
    ],
    totals: {
      Subtotal: formatCurrency(cotacao.subtotal),
      Desconto: formatCurrency(cotacao.desconto),
      IVA: formatCurrency(cotacao.ivaTotal),
      Total: formatCurrency(cotacao.total),
    },
    observations: cotacao.observacoes ? [toText(cotacao.observacoes)] : [],
    pdf: {
      template: "quotations/detail",
      orientation: "portrait",
      pageSize: "A4",
    },
  };
}

export class QuotationReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.QUOTATION;

  private readonly cotacaoService = new CotacaoService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const cotacaoId = context.routeParams.cotacaoId;
    if (!/^\d+$/.test(cotacaoId ?? "")) {
      throw new ValidationApiError("cotacaoId invalido");
    }

    const cotacao = this.cotacaoService.enrichCotacao(
      await this.cotacaoService.get(cotacaoId),
    );
    return buildQuotationDetailDefinition(cotacao);
  }
}

export class QuotationListReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.QUOTATION_LIST;

  private readonly cotacaoService = new CotacaoService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseCotacaoListFilters(context.url);
    const items = await collectAllPages((page) =>
      this.cotacaoService.search({
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
      fileBaseName: "relatorio-cotacoes",
      reportName: "Relatorio de Cotacoes",
      title: "Relatorio de Cotacoes",
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
        "Total de cotacoes": items.length,
        "Valor total (MZN)": formatCurrency(totalAmount),
        Pendentes: items.filter((item) => item.estado === "PENDENTE").length,
        Aprovadas: items.filter((item) => item.estado === "APROVADA").length,
      },
      tables: [
        {
          title: "Cotacoes",
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
        template: "quotations/list",
        orientation: "landscape",
        pageSize: "A4",
      },
    };
  }
}
