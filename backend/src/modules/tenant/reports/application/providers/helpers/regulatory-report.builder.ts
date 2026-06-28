import { toText } from "../../helpers/report-export.helper";
import { type ModuleReportDefinition, type ReportSectionTable } from "../../types/report.types";

export function parseRegulatoryFilters(url: URL) {
  const query = url.searchParams;
  return {
    search: query.get("q")?.trim() || query.get("search")?.trim() || undefined,
    clienteId: query.get("clienteId")?.trim() || undefined,
    produtoId: query.get("produtoId")?.trim() || undefined,
    responsavelId: query.get("responsavelId")?.trim() || undefined,
    status: query.get("status")?.trim() || undefined,
    origem: query.get("origem")?.trim() || undefined,
    tipoMovimento: query.get("tipoMovimento")?.trim() || undefined,
    estado: query.get("estado")?.trim() || undefined,
    alertaTipo: query.get("alertaTipo")?.trim() || undefined,
    from: query.get("from")?.trim() || undefined,
    to: query.get("to")?.trim() || undefined,
    sortBy: query.get("sortBy")?.trim() || undefined,
    sortDir: (query.get("sortDir")?.trim() as "asc" | "desc") || undefined,
  };
}

export function formatDateTime(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return toText(value);
  return date.toISOString().replace("T", " ").slice(0, 16);
}

export function buildRegulatoryReportDefinition(input: {
  fileBaseName: string;
  reportName: string;
  title: string;
  subtitle?: string;
  filters: Record<string, unknown>;
  kpis: Record<string, unknown>;
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
