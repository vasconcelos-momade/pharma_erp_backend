import {
  ListLivroPsicotropicosUseCase,
  LivroPsicotropicosDashboardUseCase,
} from "../../../regulatory/application/use-cases/livro-psicotropicos.use-case";
import {
  ListLivroReceitasUseCase,
  LivroReceitasDashboardUseCase,
} from "../../../regulatory/application/use-cases/livro-receitas.use-case";
import {
  ListReceitasUseCase,
  ReceitasDashboardUseCase,
} from "../../../regulatory/application/use-cases/receitas.use-case";
import {
  ListSanitarioUseCase,
  SanitarioDashboardUseCase,
} from "../../../regulatory/application/use-cases/sanitario.use-case";
import { collectAllPages } from "../helpers/report-pagination.helper";
import { toText } from "../helpers/report-export.helper";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";
import { REPORT_KEYS } from "../constants/report-keys";
import {
  buildRegulatoryReportDefinition,
  formatDateTime,
  parseRegulatoryFilters,
} from "./helpers/regulatory-report.builder";

export class RegulatoryReceitasReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.REGULATORY_RECEITAS;

  private readonly dashboardUseCase = new ReceitasDashboardUseCase();
  private readonly listUseCase = new ListReceitasUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseRegulatoryFilters(context.url);
    const [dashboard, items] = await Promise.all([
      this.dashboardUseCase.execute(filters),
      collectAllPages((page) =>
        this.listUseCase.execute({
          ...filters,
          status: filters.status as any,
          origem: filters.origem as any,
          sortBy: (filters.sortBy as any) ?? "dataReceita",
          sortDir: filters.sortDir ?? "desc",
          page,
          pageSize: 100,
        }),
      ),
    ]);

    const kpis = dashboard.kpis ?? {};

    return buildRegulatoryReportDefinition({
      fileBaseName: "receitas",
      reportName: "Receitas",
      title: "Relatorio de Receitas",
      subtitle: "Prescricoes e receitas medicas",
      filters: {
        Pesquisa: filters.search ?? "-",
        Cliente: filters.clienteId ?? "-",
        Estado: filters.status ?? "-",
        Origem: filters.origem ?? "-",
        De: filters.from ?? "-",
        Ate: filters.to ?? "-",
      },
      kpis: {
        Emitidas: kpis.emitidas ?? 0,
        Utilizadas: kpis.utilizadas ?? 0,
        Pendentes: kpis.pendentes ?? 0,
        Expiradas: kpis.expiradas ?? 0,
        Registos: items.length,
      },
      tables: [
        {
          title: "Receitas",
          columns: [
            "Numero",
            "Cliente",
            "Medico",
            "Unidade",
            "Data",
            "Estado",
            "Origem",
          ],
          rows: items.map((item: any) => [
            toText(item.numeroReceita),
            toText(item.cliente?.nome ?? item.clienteNome),
            toText(item.medicoNome),
            toText(item.unidadeSanitaria),
            formatDateTime(item.dataReceita),
            toText(item.status),
            toText(item.origem),
          ]),
        },
      ],
      totals: { Registos: items.length },
    });
  }
}

export class RegulatoryLivroReceitasReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.REGULATORY_LIVRO_RECEITAS;

  private readonly dashboardUseCase = new LivroReceitasDashboardUseCase();
  private readonly listUseCase = new ListLivroReceitasUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseRegulatoryFilters(context.url);
    const [dashboard, items] = await Promise.all([
      this.dashboardUseCase.execute(filters),
      collectAllPages((page) =>
        this.listUseCase.execute({
          ...filters,
          origem: filters.origem as any,
          tipoMovimento: filters.tipoMovimento as any,
          sortBy: (filters.sortBy as any) ?? "createdAt",
          sortDir: filters.sortDir ?? "desc",
          page,
          pageSize: 100,
        }),
      ),
    ]);

    const kpis = dashboard.kpis ?? {};

    return buildRegulatoryReportDefinition({
      fileBaseName: "livro-receitas",
      reportName: "Livro de Receitas",
      title: "Livro de Receitas",
      filters: {
        Pesquisa: filters.search ?? "-",
        Cliente: filters.clienteId ?? "-",
        Produto: filters.produtoId ?? "-",
        Movimento: filters.tipoMovimento ?? "-",
        Origem: filters.origem ?? "-",
      },
      kpis: {
        Movimentos: kpis.totalMovimentos ?? 0,
        Entradas: kpis.entradas ?? 0,
        Saidas: kpis.saidas ?? 0,
        Pacientes: kpis.pacientesUnicos ?? 0,
        Registos: items.length,
      },
      tables: [
        {
          title: "Livro de receitas",
          columns: [
            "Receita",
            "Cliente",
            "Produto",
            "Lote",
            "Movimento",
            "Qtd",
            "Medico",
            "Data",
          ],
          rows: items.map((item: any) => [
            toText(item.numeroReceita),
            toText(item.cliente?.nome ?? item.clienteNome),
            toText(item.produto?.nomeComercial ?? item.produtoNomeComercial),
            toText(item.lote?.numeroLote ?? item.numeroLote),
            toText(item.tipoMovimento),
            toText(item.quantidade, "0"),
            toText(item.medicoNome),
            formatDateTime(item.dataReceita ?? item.createdAt),
          ]),
        },
      ],
      totals: { Registos: items.length },
    });
  }
}

export class RegulatoryLivroPsicotropicosReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.REGULATORY_LIVRO_PSICOTROPICOS;

  private readonly dashboardUseCase = new LivroPsicotropicosDashboardUseCase();
  private readonly listUseCase = new ListLivroPsicotropicosUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseRegulatoryFilters(context.url);
    const [dashboard, items] = await Promise.all([
      this.dashboardUseCase.execute(filters),
      collectAllPages((page) =>
        this.listUseCase.execute({
          ...filters,
          tipoMovimento: filters.tipoMovimento as any,
          sortBy: (filters.sortBy as any) ?? "createdAt",
          sortDir: filters.sortDir ?? "desc",
          page,
          pageSize: 100,
        }),
      ),
    ]);

    const kpis = dashboard.kpis ?? {};

    return buildRegulatoryReportDefinition({
      fileBaseName: "livro-psicotropicos",
      reportName: "Livro de Psicotropicos",
      title: "Livro de Psicotropicos",
      filters: {
        Pesquisa: filters.search ?? "-",
        Produto: filters.produtoId ?? "-",
        Movimento: filters.tipoMovimento ?? "-",
      },
      kpis: {
        Movimentos: kpis.totalMovimentos ?? 0,
        Entradas: kpis.entradas ?? 0,
        Saidas: kpis.saidas ?? 0,
        Importacoes: kpis.importacoes ?? 0,
        Registos: items.length,
      },
      tables: [
        {
          title: "Livro B - Psicotropicos",
          columns: [
            "Documento",
            "Produto",
            "Lote",
            "Movimento",
            "Qtd",
            "Responsavel",
            "Data",
          ],
          rows: items.map((item: any) => [
            toText(item.numeroDocumento),
            toText(item.produto?.nomeComercial ?? item.produtoNomeComercial),
            toText(item.lote?.numeroLote),
            toText(item.tipoMovimento),
            toText(item.quantidade, "0"),
            toText(item.responsavel?.name ?? item.responsavelNome),
            formatDateTime(item.createdAt),
          ]),
        },
      ],
      totals: { Registos: items.length },
    });
  }
}

export class RegulatorySanitarioReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.REGULATORY_SANITARIO;

  private readonly dashboardUseCase = new SanitarioDashboardUseCase();
  private readonly listUseCase = new ListSanitarioUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseRegulatoryFilters(context.url);
    const [dashboard, items] = await Promise.all([
      this.dashboardUseCase.execute(filters),
      collectAllPages((page) =>
        this.listUseCase.execute({
          search: filters.search,
          estado: filters.estado as any,
          alertaTipo: filters.alertaTipo as any,
          produtoId: filters.produtoId,
          sortBy: (filters.sortBy as any) ?? "dataValidade",
          sortDir: filters.sortDir ?? "asc",
          page,
          pageSize: 100,
        }),
      ),
    ]);

    const kpis = dashboard.kpis ?? {};

    return buildRegulatoryReportDefinition({
      fileBaseName: "alertas-sanitarios",
      reportName: "Sanitario e Alertas",
      title: "Relatorio Sanitario",
      subtitle: "Lotes, validades e alertas regulatorios",
      filters: {
        Pesquisa: filters.search ?? "-",
        Estado: filters.estado ?? "-",
        Alerta: filters.alertaTipo ?? "-",
        Produto: filters.produtoId ?? "-",
      },
      kpis: {
        Expirados: kpis.expirados ?? 0,
        "Prox. validade": kpis.proximosValidade ?? 0,
        Recall: kpis.recall ?? 0,
        Quarentena: kpis.quarentena ?? 0,
        Alertas: kpis.alertasSanitarios ?? 0,
        Registos: items.length,
      },
      tables: [
        {
          title: "Monitorizacao sanitaria",
          columns: [
            "Produto",
            "Lote",
            "Validade",
            "Stock",
            "Estado",
            "Alerta",
            "Fornecedor",
          ],
          rows: items.map((item: any) => [
            toText(item.produto?.nomeComercial),
            toText(item.numeroLote),
            formatDateTime(item.dataValidade),
            toText(item.quantidadeAtual, "0"),
            toText(item.status ?? item.estadoSanitario),
            toText(item.latestAlert?.tipo),
            "-",
          ]),
        },
      ],
      totals: { Registos: items.length },
    });
  }
}
