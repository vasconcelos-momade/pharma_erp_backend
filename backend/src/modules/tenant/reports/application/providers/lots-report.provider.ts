import {
  LotesDashboardUseCase,
  SearchLotesUseCase,
} from "../../../stock/application/use-cases/lotes/search-lotes.use-case";
import { collectAllPages } from "../helpers/report-pagination.helper";
import { formatCurrency, toText } from "../helpers/report-export.helper";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";
import { buildProductReportDefinition, formatDateTime } from "./helpers/pharmacy-report.builder";
import { REPORT_KEYS, type ReportKey } from "../constants/report-keys";

function parseLotsFilters(url: URL, expirado: boolean) {
  const query = url.searchParams;
  return {
    q: query.get("q")?.trim() || undefined,
    produtoId: query.get("produtoId")?.trim() || undefined,
    fornecedorId: query.get("fornecedorId")?.trim() || undefined,
    estadoSanitario: query.get("estadoSanitario")?.trim() || undefined,
    disponibilidade: query.get("disponibilidade")?.trim() || undefined,
    expirado,
  };
}

function mapLotRows(items: Array<Record<string, unknown>>) {
  return items.map((item) => [
    toText(item.produtoNomeComercial),
    toText(item.numeroLote),
    formatDateTime(item.dataValidade),
    toText(item.diasRestantes),
    toText(item.quantidadeDisponivel, "0"),
    formatCurrency(item.valorEmStock),
    toText(item.estadoSanitario),
    toText(item.disponibilidade),
  ]);
}

abstract class BaseLotsReportProvider implements ReportDataProvider {
  abstract readonly reportKey: ReportKey;
  abstract readonly expirado: boolean;

  protected readonly searchUseCase = new SearchLotesUseCase();
  protected readonly dashboardUseCase = new LotesDashboardUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseLotsFilters(context.url, this.expirado);
    const [dashboard, items] = await Promise.all([
      this.dashboardUseCase.execute(),
      collectAllPages<Record<string, unknown>>((page) =>
        this.searchUseCase.execute({
          ...filters,
          page,
          pageSize: 100,
        }) as Promise<{ items: Array<Record<string, unknown>>; hasMore: boolean }>,
      ),
    ]);

    const reportName = this.expirado ? "Lotes Expirados" : "Lotes Activos";
    return buildProductReportDefinition({
      fileBaseName: this.expirado ? "lotes-expirados" : "lotes-activos",
      reportName,
      title: reportName,
      filters: {
        Pesquisa: filters.q ?? "-",
        Produto: filters.produtoId ?? "-",
        Fornecedor: filters.fornecedorId ?? "-",
        "Estado sanitario": filters.estadoSanitario ?? "-",
        Disponibilidade: filters.disponibilidade ?? "-",
      },
      kpis: {
        "Total de lotes": dashboard.totalLotes,
        Disponiveis: dashboard.lotesDisponiveis,
        Expirados: dashboard.lotesExpirados,
        Sanitarios: dashboard.lotesSanitarios,
        "Lotes no relatorio": items.length,
      },
      tables: [
        {
          title: reportName,
          columns: [
            "Produto",
            "Lote",
            "Validade",
            "Dias",
            "Qtd",
            "Valor",
            "Estado",
            "Disponibilidade",
          ],
          rows: mapLotRows(items),
        },
      ],
      totals: {
        Registos: items.length,
        "Valor (MZN)": formatCurrency(
          items.reduce(
            (sum, item) => sum + Number(item.valorEmStock ?? 0),
            0,
          ),
        ),
      },
    });
  }
}

export class LotsActiveReportProvider extends BaseLotsReportProvider {
  readonly reportKey = REPORT_KEYS.LOTS_ACTIVE;
  readonly expirado = false;
}

export class LotsExpiredReportProvider extends BaseLotsReportProvider {
  readonly reportKey = REPORT_KEYS.LOTS_EXPIRED;
  readonly expirado = true;
}
