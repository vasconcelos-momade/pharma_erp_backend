import { toText } from "../../helpers/report-export.helper";
import { type ModuleReportDefinition, type ReportSectionTable } from "../types/report.types";
import {
  type AdminAuditQuery,
  type AdminLoginHistoryQuery,
  type AdminPermissionsQuery,
  type AdminSessionQuery,
  type AdminUserQuery,
} from "../../../users/application/services/admin-reporting.service";

export function formatAdminDateTime(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return toText(value);
  return date.toISOString().replace("T", " ").slice(0, 16);
}

export function buildAdminReportDefinition(input: {
  fileBaseName: string;
  reportName: string;
  title: string;
  subtitle?: string;
  filters?: Record<string, unknown>;
  kpis?: Record<string, unknown>;
  tables: ReportSectionTable[];
  totals?: Record<string, unknown>;
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
    orientation: "landscape",
    pdf: { orientation: "landscape", pageSize: "A4" },
  };
}

export function userFilterLabels(query: AdminUserQuery) {
  return {
    Pesquisa: query.q ?? query.search ?? "-",
    Perfil: query.role ?? "-",
    Estado:
      query.active === undefined ? "-" : query.active ? "Activo" : "Inactivo",
    Ordenacao: query.sortBy ?? "name",
    Direccao: query.sortOrder ?? "asc",
  };
}

export function sessionFilterLabels(query: AdminSessionQuery) {
  return {
    Pesquisa: query.q ?? "-",
    "Apenas activas": query.activeOnly ? "Sim" : "Nao",
  };
}

export function loginHistoryFilterLabels(query: AdminLoginHistoryQuery) {
  return {
    Pesquisa: query.q ?? "-",
    Resultado:
      query.success === undefined ? "-" : query.success ? "Sucesso" : "Falha",
    De: query.dateFrom ?? "-",
    Ate: query.dateTo ?? "-",
  };
}

export function auditFilterLabels(query: AdminAuditQuery) {
  return {
    Pesquisa: query.q ?? "-",
    Utilizador: query.userId ?? "-",
    De: query.dateFrom ?? "-",
    Ate: query.dateTo ?? "-",
  };
}

export function permissionsFilterLabels(query: AdminPermissionsQuery) {
  return {
    Perfil: query.role ?? "Todos",
  };
}

export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: "Administrador",
    GERENTE: "Gerente",
    FARMACEUTICO: "Farmaceutico",
    DIRETOR_TECNICO: "Director Tecnico",
    CAIXA: "Caixa",
  };
  return labels[role] ?? role;
}
