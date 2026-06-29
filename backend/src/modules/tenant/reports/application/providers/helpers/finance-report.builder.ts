import { formatCurrency, toText } from "../../helpers/report-export.helper";
import { type ModuleReportDefinition, type ReportSectionTable } from "../types/report.types";

export function parseFinancePeriodFilters(url: URL) {
  const query = url.searchParams;
  return {
    days: query.get("days") ? Number(query.get("days")) : undefined,
    period: query.get("period")?.trim() || undefined,
    from: query.get("from")?.trim() || undefined,
    to: query.get("to")?.trim() || undefined,
    search: query.get("q")?.trim() || query.get("search")?.trim() || undefined,
    status: query.get("status")?.trim() || undefined,
    clienteId: query.get("clienteId")?.trim() || undefined,
    fornecedorId: query.get("fornecedorId")?.trim() || undefined,
  };
}

export function formatDateTime(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return toText(value);
  return date.toISOString().replace("T", " ").slice(0, 16);
}

export function buildFinanceReportDefinition(input: {
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

export function periodFilterLabels(filters: ReturnType<typeof parseFinancePeriodFilters>) {
  return {
    Periodo: filters.period ?? "-",
    De: filters.from ?? "-",
    Ate: filters.to ?? "-",
    Dias: filters.days ?? "-",
    Pesquisa: filters.search ?? "-",
  };
}
