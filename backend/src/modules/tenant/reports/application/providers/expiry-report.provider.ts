import {
  SearchValidadesUseCase,
  ValidadesDashboardUseCase,
} from "../../../stock/application/use-cases/lotes/validades.use-case";
import { formatCurrency, toText } from "../helpers/report-export.helper";
import { REPORT_KEYS } from "../constants/report-keys";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";

function bucketLabel(bucket?: string): string {
  switch (bucket) {
    case "expirado":
      return "Expirados";
    case "30":
      return "Ate 30 dias";
    case "60":
      return "Ate 60 dias";
    case "todos":
      return "Todos";
    default:
      return "Ate 60 dias";
  }
}

export class ExpiryReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.EXPIRY;

  private readonly dashboardUseCase = new ValidadesDashboardUseCase();
  private readonly searchUseCase = new SearchValidadesUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = context.url.searchParams;
    const q = query.get("q")?.trim() || undefined;
    const rawBucket = query.get("bucket");
    const bucket =
      rawBucket === "expirado" ||
      rawBucket === "30" ||
      rawBucket === "60" ||
      rawBucket === "todos"
        ? rawBucket
        : undefined;

    const [dashboard, items] = await Promise.all([
      this.dashboardUseCase.execute(),
      this.collectAllItems(q, bucket),
    ]);

    return {
      fileBaseName: `relatorio-validades-${bucketLabel(bucket)}`,
      reportName: "Relatorio de Validades",
      filters: {
        Pesquisa: q ?? "-",
        Janela: bucketLabel(bucket),
      },
      kpis: {
        Expirados: dashboard.lotesExpirados,
        "30 dias": dashboard.expiramEm30Dias,
        "60 dias": dashboard.expiramEm60Dias,
        "Valor em risco (MZN)": formatCurrency(dashboard.valorFinanceiroEmRisco),
      },
      tables: [
        {
          title: "Lotes monitorizados",
          columns: ["Produto", "Lote", "Validade", "Dias", "Qtd", "Valor", "Estado"],
          rows: items.map((item) => [
            item.produtoNomeComercial,
            item.numeroLote,
            item.dataValidade,
            item.diasRestantes,
            item.quantidadeDisponivel,
            formatCurrency(item.valorEmStock),
            item.estado,
          ]),
        },
      ],
      totals: {
        "Total de lotes": items.length,
        "Valor financeiro em risco (MZN)": formatCurrency(
          items.reduce((total, item) => total + Number(item.valorEmStock ?? 0), 0),
        ),
      },
      observations: [
        "Documento institucional gerado pelo motor unico de relatorios.",
        "Todos os calculos permanecem no backend.",
      ],
    };
  }

  private async collectAllItems(
    q?: string,
    bucket?: "expirado" | "30" | "60" | "todos",
  ) {
    const items: Array<Record<string, unknown>> = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.searchUseCase.execute({
        q,
        bucket,
        page,
        pageSize: 100,
      });
      items.push(...result.items);
      hasMore = result.hasMore;
      page += 1;
    }

    return items.map((item) => ({
      produtoNomeComercial: toText(item.produtoNomeComercial),
      numeroLote: toText(item.numeroLote),
      dataValidade: toText(item.dataValidade),
      diasRestantes: toText(item.diasRestantes),
      quantidadeDisponivel: toText(item.quantidadeDisponivel, "0"),
      valorEmStock: item.valorEmStock,
      estado: toText(item.estado),
    }));
  }
}
