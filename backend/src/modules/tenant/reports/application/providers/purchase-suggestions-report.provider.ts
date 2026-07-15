import { collectAllPages } from "../helpers/report-pagination.helper";
import { formatCurrency, toText } from "../helpers/report-export.helper";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";
import { REPORT_KEYS, type ReportKey } from "../constants/report-keys";
import { PurchaseSuggestionsUseCase } from "../../../stock/application/use-cases/purchases/purchase-suggestions.use-case";
import { buildStockReportDefinition } from "./helpers/stock-report.builder";

const REPORT_COLUMNS = [
  "Produto",
  "Origem",
  "Estoque Atual",
  "Estoque Mínimo",
  "Consumo Médio Diário",
  "Quantidade Sugerida",
  "Fornecedor Principal",
  "Observação",
] as const;

function parseSuggestionFilters(url: URL) {
  return {
    q: url.searchParams.get("q") ?? undefined,
    origem: (url.searchParams.get("origem") as "AUTOMATICA" | "MANUAL" | "TODAS") ?? undefined,
    sortBy: url.searchParams.get("sortBy") ?? undefined,
    sortOrder: (url.searchParams.get("sortOrder") as "asc" | "desc") ?? undefined,
    supplierId: url.searchParams.get("supplierId") ?? undefined,
  };
}

function mapSuggestionRow(item: Record<string, unknown>) {
  return [
    toText(item.produtoNome),
    toText(item.origem === "MANUAL" ? "Manual" : "Automática"),
    toText(item.estoqueAtual, "0"),
    toText(item.estoqueMinimo, "0"),
    toText(item.consumoMedioDiario, "0"),
    toText(item.quantidadeSugerida, "0"),
    toText(item.fornecedorNome),
    item.observacao ? toText(item.observacao) : "-",
  ];
}

export class PurchaseSuggestionsReportProvider implements ReportDataProvider {
  readonly reportKey: ReportKey = REPORT_KEYS.PURCHASE_SUGGESTIONS;

  private readonly listUseCase = new PurchaseSuggestionsUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseSuggestionFilters(context.url);

    const firstPage = await this.listUseCase.execute({
      ...filters,
      page: 1,
      pageSize: 100,
    });

    const grouped = await this.loadAllGrouped(filters);
    const dashboard = firstPage.dashboard;
    const totalItems = grouped.reduce((sum, group) => sum + group.items.length, 0);

    return buildStockReportDefinition({
      fileBaseName: "sugestao-compras",
      reportName: "Sugestão de Compras",
      title: "Sugestão de Compras",
      subtitle: "Lista consolidada agrupada por fornecedor principal",
      filters: {
        Pesquisa: filters.q ?? "-",
        Origem: filters.origem ?? "Todas",
      },
      kpis: {
        Produtos: dashboard.produtosSugeridos,
        "Sem stock": dashboard.produtosSemStock,
        "Qtd. total sugerida": dashboard.quantidadeTotalSugerida,
        Fornecedores: dashboard.fornecedoresEnvolvidos,
        "Valor estimado": formatCurrency(dashboard.valorEstimadoCompra),
      },
      tables: grouped.map((group) => ({
        title: group.fornecedorNome,
        columns: [...REPORT_COLUMNS],
        rows: group.items.map((item) =>
          mapSuggestionRow(item as Record<string, unknown>),
        ),
      })),
      totals: {
        Registos: totalItems,
        Fornecedores: grouped.length,
        "Qtd. total": grouped.reduce(
          (sum, group) =>
            sum +
            group.items.reduce(
              (inner, item) => inner + Number(item.quantidadeSugerida ?? 0),
              0,
            ),
          0,
        ),
      },
    });
  }

  /** Carrega todas as páginas e reagrupa por fornecedor (ordem alfabética). */
  private async loadAllGrouped(filters: ReturnType<typeof parseSuggestionFilters>) {
    const items = await collectAllPages<Record<string, unknown>>((page) =>
      this.listUseCase.execute({ ...filters, page, pageSize: 100 }).then((result) => ({
        items: result.items as Array<Record<string, unknown>>,
        hasMore: result.hasMore,
      })),
    );

    const grouped = new Map<string, { fornecedorNome: string; items: Record<string, unknown>[] }>();
    for (const item of items) {
      const key = (item.fornecedorId as string | null) ?? "sem-fornecedor";
      const nome = (item.fornecedorNome as string | undefined) ?? "Sem fornecedor";
      const bucket = grouped.get(key) ?? { fornecedorNome: nome, items: [] };
      bucket.items.push(item);
      grouped.set(key, bucket);
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.fornecedorNome.localeCompare(b.fornecedorNome),
    );
  }
}
