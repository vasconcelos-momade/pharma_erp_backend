import { toText } from "../../helpers/report-export.helper";
import { type ModuleReportDefinition, type ReportSectionTable } from "../../types/report.types";
import { type AuditDashboardSnapshot, type AuditSearchQuery } from "../../../../audit/application/services/audit-reporting.service";

export function formatAuditDateTime(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return toText(value);
  return date.toISOString().replace("T", " ").slice(0, 16);
}

export function parseAuditFilters(query: AuditSearchQuery, options?: { useType?: boolean }) {
  return {
    Pesquisa: query.q ?? "-",
    Entidade: query.entity ?? "-",
    Acao: options?.useType ? "-" : (query.action ?? "-"),
    Tipo: options?.useType ? (query.type ?? "-") : "-",
    Utilizador: query.userId ?? "-",
    De: query.dateFrom ?? "-",
    Ate: query.dateTo ?? "-",
  };
}

export function stringifyAuditValue(value: unknown): string {
  if (value == null) {
    return "-";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[objeto]";
    }
  }
  return toText(value);
}

export function buildAuditReportDefinition(input: {
  fileBaseName: string;
  reportName: string;
  title: string;
  subtitle?: string;
  filters?: Record<string, unknown>;
  kpis?: Record<string, unknown>;
  tables: ReportSectionTable[];
  totals?: Record<string, unknown>;
  observations?: string[];
}): ModuleReportDefinition {
  return {
    fileBaseName: input.fileBaseName,
    reportName: input.reportName,
    title: input.title,
    subtitle: input.subtitle,
    filters: input.filters,
    kpis: input.kpis,
    tables: input.tables,
    totals: input.totals,
    observations: input.observations,
    orientation: "landscape",
    pdf: { orientation: "landscape", pageSize: "A4" },
  } as ModuleReportDefinition;
}

export function buildAuditDashboardReport(data: AuditDashboardSnapshot): ModuleReportDefinition {
  return buildAuditReportDefinition({
    fileBaseName: "auditoria-dashboard",
    reportName: "Dashboard de Auditoria",
    title: "Dashboard de Auditoria",
    subtitle: "Indicadores de integridade, eventos criticos e alteracoes sensiveis",
    kpis: {
      "Logs totais": data.totalLogs,
      "Logs 24h": data.logsLast24h,
      "Eventos criticos 7d": data.criticalEventsLast7d,
      "Alteracoes de permissoes 7d": data.permissionChangesLast7d,
      "Alteracoes de utilizadores 7d": data.userChangesLast7d,
      "Eventos recentes": data.recentEvents.length,
    },
    tables: [
      {
        title: "Eventos recentes",
        columns: ["Data", "Tipo", "Entidade", "ID entidade", "Utilizador"],
        rows: data.recentEvents.map((event) => [
          formatAuditDateTime(event.createdAt),
          toText(event.type),
          toText(event.entity),
          toText(event.entityId),
          toText(event.user?.nome, "Sistema"),
        ]),
      },
    ],
    totals: {
      "Eventos recentes": data.recentEvents.length,
    },
  });
}
