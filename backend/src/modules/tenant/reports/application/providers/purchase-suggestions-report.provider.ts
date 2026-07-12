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

function parseSuggestionFilters(url: URL) {
  return {
    q: url.searchParams.get("q") ?? undefined,
    origem: (url.searchParams.get("origem") as "AUTOMATICA" | "MANUAL" | "TODAS") ?? undefined,
    sortBy: url.searchParams.get("sortBy") ?? undefined,
    sortOrder: (url.searchParams.get("sortOrder") as "asc" | "desc") ?? undefined,
  };
}

function mapSuggestionRows(items: Array<Record<string, unknown>>) {
  return items.map((item) => [
    toText(item.produtoNome),
    toText(item.categoriaNome),
    toText(item.origem === "MANUAL" ? "Manual" : "Automática"),
    toText(item.estoqueAtual, "0"),
    toText(item.estoqueMinimo, "0"),
    toText(item.consumoMedioDiario, "0"),
    toText(item.quantidadeSugerida, "0"),
    toText(item.fornecedorNome),
    item.observacao ? toText(item.observacao) : "-",
  ]);
}

export class PurchaseSuggestionsReportProvider implements ReportDataProvider {
  readonly reportKey: ReportKey = REPORT_KEYS.PURCHASE_SUGGESTIONS;

  private readonly listUseCase = new PurchaseSuggestionsUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseSuggestionFilters(context.url);

    const [firstPage, items] = await Promise.all([
      this.listUseCase.execute({ ...filters, page: 1, pageSize: 1 }),
      collectAllPages<Record<string, unknown>>((page) =>
        this.listUseCase.execute({ ...filters, page, pageSize: 100 }).then((result) => ({
          items: result.items as Array<Record<string, unknown>>,
          hasMore: result.hasMore,
        })),
      ),
    ]);

    const dashboard = firstPage.dashboard;

    return buildStockReportDefinition({
      fileBaseName: "sugestao-compras",
      reportName: "Sugestão de Compras",
      title: "Sugestão de Compras",
      subtitle: "Lista consolidada para aquisição junto aos fornecedores",
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
      tables: [
        {
          title: "Itens sugeridos",
          columns: [
            "Produto",
            "Categoria",
            "Origem",
            "Estoque Atual",
            "Estoque Mínimo",
            "Consumo Médio Diário",
            "Quantidade Sugerida",
            "Fornecedor Principal",
            "Observação",
          ],
          rows: mapSuggestionRows(items),
        },
      ],
      totals: {
        Registos: items.length,
        "Qtd. total": items.reduce(
          (sum, item) => sum + Number(item.quantidadeSugerida ?? 0),
          0,
        ),
      },
    });
  }
}
