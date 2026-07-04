import { formatCurrency, toText } from "../../helpers/report-export.helper";
import { type ModuleReportDefinition, type ReportSectionTable } from "../../types/report.types";

export function parseStockMovementFilters(url: URL) {
  const query = url.searchParams;
  return {
    q: query.get("q")?.trim() || query.get("search")?.trim() || undefined,
    tipo: query.get("tipo")?.trim() || undefined,
    origem: query.get("origem")?.trim() || undefined,
    produtoId: query.get("produtoId")?.trim() || undefined,
    loteId: query.get("loteId")?.trim() || undefined,
    dataInicio: query.get("dataInicio")?.trim() || undefined,
    dataFim: query.get("dataFim")?.trim() || undefined,
  };
}

export function parseRequisitionFilters(url: URL) {
  const query = url.searchParams;
  return {
    status: query.get("status")?.trim() || undefined,
    tipo: query.get("tipo")?.trim() || undefined,
    origem: query.get("origem")?.trim() || undefined,
    destino: query.get("destino")?.trim() || undefined,
    fornecedorId: query.get("fornecedorId")?.trim() || undefined,
  };
}

export function formatDateTime(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return toText(value);
  return date.toISOString().replace("T", " ").slice(0, 16);
}

export function buildStockReportDefinition(input: {
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

export function mapMovementRows(items: Array<Record<string, unknown>>) {
  return items.map((item) => [
    formatDateTime(item.createdAt),
    toText(item.tipoLabel ?? item.tipo),
    toText((item.produto as any)?.nomeComercial ?? item.produtoNomeComercial),
    toText((item.lote as any)?.numeroLote ?? item.numeroLote),
    toText(item.quantidade, "0"),
    toText(item.estoqueAnterior, "0"),
    toText(item.estoqueFinal, "0"),
    toText(item.origemLabel ?? item.origem),
    toText(item.documentoReferencia),
    toText((item.user as any)?.nome ?? item.userNome),
  ]);
}

export const movementTableColumns = [
  "Data",
  "Tipo",
  "Produto",
  "Lote",
  "Qtd",
  "Stock ant.",
  "Stock final",
  "Origem",
  "Documento",
  "Utilizador",
];
