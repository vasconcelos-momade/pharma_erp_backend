import { RegulatoryLivroPsicotropicosReportProvider } from "./regulatory-report.provider";
import { FinanceCashflowReportProvider } from "./finance-report.provider";
import { StockMovementsReportProvider } from "./stock-movements-report.provider";
import { collectAllPages } from "../helpers/report-pagination.helper";
import { toText } from "../helpers/report-export.helper";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";
import { AuditReportingService } from "../../../audit/application/services/audit-reporting.service";
import { REPORT_KEYS } from "../constants/report-keys";
import {
  buildAuditDashboardReport,
  buildAuditReportDefinition,
  formatAuditDateTime,
  parseAuditFilters,
  stringifyAuditValue,
} from "./helpers/audit-report.builder";

export class AuditDashboardReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.AUDIT_DASHBOARD;

  private readonly auditService = new AuditReportingService();

  async build(): Promise<ModuleReportDefinition> {
    return buildAuditDashboardReport(await this.auditService.dashboard());
  }
}

export class AuditLogsReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.AUDIT_LOGS;

  private readonly auditService = new AuditReportingService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = this.auditService.parseQuery(context.url);
    const items = await collectAllPages((page) =>
      this.auditService.listAuditLogs({
        ...query,
        page,
        pageSize: 100,
      }),
    );

    return buildAuditReportDefinition({
      fileBaseName: "auditoria-logs",
      reportName: "Logs de Auditoria",
      title: "Logs de Auditoria",
      subtitle: "Trilho imutavel de alteracoes por entidade, acao e utilizador",
      filters: parseAuditFilters(query),
      kpis: {
        Registos: items.length,
        Entidades: new Set(items.map((item) => item.entity)).size,
        Acoes: new Set(items.map((item) => item.action)).size,
      },
      tables: [
        {
          title: "Logs de auditoria",
          columns: [
            "Data",
            "Acao",
            "Entidade",
            "ID entidade",
            "Utilizador",
            "IP",
            "Antes",
            "Depois",
          ],
          rows: items.map((item) => [
            formatAuditDateTime(item.createdAt),
            toText(item.action),
            toText(item.entity),
            toText(item.entityId),
            toText(item.user?.nome, "Sistema"),
            toText(item.ip),
            stringifyAuditValue(item.before),
            stringifyAuditValue(item.after),
          ]),
        },
      ],
      totals: {
        Registos: items.length,
      },
    });
  }
}

export class AuditTimelineReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.AUDIT_TIMELINE;

  private readonly auditService = new AuditReportingService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = this.auditService.parseQuery(context.url);
    const items = await collectAllPages((page) =>
      this.auditService.listBusinessEvents({
        ...query,
        page,
        pageSize: 100,
      }),
    );

    return buildAuditReportDefinition({
      fileBaseName: "auditoria-cronologia",
      reportName: "Cronologia de Auditoria",
      title: "Cronologia de Auditoria",
      subtitle: "Sequencia cronologica de eventos de negocio auditados",
      filters: parseAuditFilters(query, { useType: true }),
      kpis: {
        Registos: items.length,
        Tipos: new Set(items.map((item) => item.type)).size,
        Entidades: new Set(items.map((item) => item.entity)).size,
      },
      tables: [
        {
          title: "Linha temporal de eventos",
          columns: ["Data", "Tipo", "Entidade", "ID entidade", "Utilizador"],
          rows: items.map((item) => [
            formatAuditDateTime(item.createdAt),
            toText(item.type),
            toText(item.entity),
            toText(item.entityId),
            toText(item.user?.nome, "Sistema"),
          ]),
        },
      ],
      totals: {
        Registos: items.length,
      },
    });
  }
}

export class AuditBusinessEventsReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.AUDIT_BUSINESS_EVENTS;

  private readonly auditService = new AuditReportingService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = this.auditService.parseQuery(context.url);
    const items = await collectAllPages((page) =>
      this.auditService.listBusinessEvents({
        ...query,
        page,
        pageSize: 100,
      }),
    );

    return buildAuditReportDefinition({
      fileBaseName: "auditoria-eventos-negocio",
      reportName: "Eventos de Negocio",
      title: "Eventos de Negocio Auditados",
      subtitle: "Eventos correlacionados com utilizador, entidade e payload operacional",
      filters: parseAuditFilters(query, { useType: true }),
      kpis: {
        Registos: items.length,
        Tipos: new Set(items.map((item) => item.type)).size,
      },
      tables: [
        {
          title: "Eventos de negocio",
          columns: ["Data", "Tipo", "Entidade", "ID entidade", "Utilizador", "Payload"],
          rows: items.map((item) => [
            formatAuditDateTime(item.createdAt),
            toText(item.type),
            toText(item.entity),
            toText(item.entityId),
            toText(item.user?.nome, "Sistema"),
            stringifyAuditValue(item.payload),
          ]),
        },
      ],
      totals: {
        Registos: items.length,
      },
    });
  }
}

export class AuditPsychotropicsReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.AUDIT_PSYCHOTROPICS;

  private readonly provider = new RegulatoryLivroPsicotropicosReportProvider();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const definition = await this.provider.build(context);
    return {
      ...definition,
      fileBaseName: "auditoria-psicotropicos",
      reportName: "Auditoria de Psicotropicos",
      title: "Auditoria de Psicotropicos",
      subtitle: "Livro B reutilizado como trilho auditavel de substancias controladas",
    } as ModuleReportDefinition;
  }
}

export class AuditStockReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.AUDIT_STOCK;

  private readonly provider = new StockMovementsReportProvider();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const definition = await this.provider.build(context);
    return {
      ...definition,
      fileBaseName: "auditoria-stock",
      reportName: "Auditoria de Stock",
      title: "Auditoria de Stock",
      subtitle: "Movimentos e rastreabilidade operacional de stock",
    } as ModuleReportDefinition;
  }
}

export class AuditFinancialReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.AUDIT_FINANCIAL;

  private readonly provider = new FinanceCashflowReportProvider();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const definition = await this.provider.build(context);
    return {
      ...definition,
      fileBaseName: "auditoria-financeira",
      reportName: "Auditoria Financeira",
      title: "Auditoria Financeira",
      subtitle: "Movimentos financeiros auditaveis e fluxo consolidado",
    } as ModuleReportDefinition;
  }
}
