import {
  FefoDashboardUseCase,
  SearchFefoAuditUseCase,
  SearchFefoOverviewUseCase,
} from "../../../stock/application/use-cases/lotes/fefo.use-case";
import { collectAllPages } from "../helpers/report-pagination.helper";
import { toText } from "../helpers/report-export.helper";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";
import { buildProductReportDefinition, formatDateTime } from "./helpers/pharmacy-report.builder";
import { REPORT_KEYS } from "../constants/report-keys";

export class FefoOverviewReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.FEFO_OVERVIEW;

  private readonly dashboardUseCase = new FefoDashboardUseCase();
  private readonly searchUseCase = new SearchFefoOverviewUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = context.url.searchParams;
    const q = query.get("q")?.trim() || undefined;
    const produtoId = query.get("produtoId")?.trim() || undefined;

    const [dashboard, items] = await Promise.all([
      this.dashboardUseCase.execute(),
      collectAllPages((page) =>
        this.searchUseCase.execute({ q, produtoId, page, pageSize: 100 }),
      ),
    ]);

    return buildProductReportDefinition({
      fileBaseName: "relatorio-fefo",
      reportName: "Relatorio FEFO",
      title: "Relatorio FEFO",
      subtitle: "First Expire, First Out — visao geral",
      filters: { Pesquisa: q ?? "-", Produto: produtoId ?? "-" },
      kpis: {
        "Fora FEFO": dashboard.produtosForaFefo,
        "Lotes expirados": dashboard.lotesExpirados,
        Bloqueados: dashboard.lotesBloqueados,
        Alertas: dashboard.alertasFefo,
      },
      tables: [
        {
          title: "Conformidade FEFO por produto",
          columns: [
            "Produto",
            "Barcode",
            "Lote recomendado",
            "Validade",
            "Stock",
            "Situacao",
            "Lotes c/ stock",
          ],
          rows: items.map((item: any) => [
            toText(item.produtoNomeComercial),
            toText(item.produtoBarcode),
            toText(item.loteRecomendado?.numeroLote),
            formatDateTime(item.loteRecomendado?.dataValidade),
            toText(item.loteRecomendado?.stock, "0"),
            toText(item.situacao),
            toText(item.totalLotesComStock, "0"),
          ]),
        },
      ],
      totals: { Produtos: items.length },
    });
  }
}

export class FefoAuditReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.FEFO_AUDIT;

  private readonly searchUseCase = new SearchFefoAuditUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = context.url.searchParams;
    const q = query.get("q")?.trim() || undefined;
    const produtoId = query.get("produtoId")?.trim() || undefined;
    const situacao = query.get("situacao")?.trim() || undefined;

    const items = await collectAllPages((page) =>
      this.searchUseCase.execute({ q, produtoId, situacao, page, pageSize: 100 }),
    );

    return buildProductReportDefinition({
      fileBaseName: "auditoria-fefo",
      reportName: "Auditoria FEFO",
      title: "Auditoria FEFO",
      subtitle: "Historico de dispensações e conformidade FEFO",
      filters: {
        Pesquisa: q ?? "-",
        Produto: produtoId ?? "-",
        Situacao: situacao ?? "-",
      },
      kpis: { Registos: items.length },
      tables: [
        {
          title: "Auditoria FEFO",
          columns: [
            "Produto",
            "Lote",
            "Fatura",
            "Situacao",
            "Utilizador",
            "Data",
          ],
          rows: items.map((item: any) => [
            toText(item.produtoNomeComercial),
            toText(item.loteUtilizado?.numeroLote),
            toText(item.documento),
            toText(item.situacao),
            toText(item.utilizador?.nome),
            formatDateTime(item.data),
          ]),
        },
      ],
      totals: { Registos: items.length },
    });
  }
}
