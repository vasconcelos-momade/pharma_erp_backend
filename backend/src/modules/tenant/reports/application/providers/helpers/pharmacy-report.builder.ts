import { formatCurrency, toText } from "../../helpers/report-export.helper";
import { type ModuleReportDefinition, type ReportSectionTable } from "../../types/report.types";

export type ProductListItem = Record<string, unknown>;

export function parseProductSearchFilters(url: URL) {
  const query = url.searchParams;
  return {
    search: query.get("q")?.trim() || query.get("search")?.trim() || undefined,
    categoriaId: query.get("categoriaId")?.trim() || undefined,
    fornecedorId: query.get("fornecedorId")?.trim() || undefined,
    tipoDispensacao: query.get("tipoDispensacao")?.trim() || undefined,
    sortBy: (query.get("sortBy")?.trim() as "nome" | "estoqueAtual" | "createdAt") || undefined,
    sortOrder: (query.get("sortOrder")?.trim() as "asc" | "desc") || undefined,
    includeInactive: query.get("includeInactive") === "true",
  };
}

export function formatDateTime(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return toText(value);
  return date.toISOString().replace("T", " ").slice(0, 16);
}

export function mapProductTableRows(items: ProductListItem[]) {
  return items.map((item) => [
    toText(item.nome),
    toText((item.categoria as any)?.nome ?? item.categoriaNome),
    toText(item.barcode),
    toText(item.estoqueAtual, "0"),
    toText(item.estoqueMinimo, "0"),
    toText(item.tipoDispensacao),
    toText(item.nomeGenerico),
    item.ativo === false ? "Nao" : "Sim",
  ]);
}

export function productTable(title: string, items: ProductListItem[]): ReportSectionTable {
  return {
    title,
    columns: [
      "Nome",
      "Categoria",
      "Barcode",
      "Stock",
      "Minimo",
      "Regulacao",
      "Substancia",
      "Ativo",
    ],
    rows: mapProductTableRows(items),
  };
}

export function buildProductReportDefinition(input: {
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

export function filterProductsNoStock(items: ProductListItem[]) {
  return items.filter((item) => Number(item.estoqueAtual ?? 0) <= 0);
}

export function filterProductsBelowMinStock(items: ProductListItem[]) {
  return items.filter((item) => {
    const disponivel = Number(item.estoqueAtual ?? 0);
    const minimo = Number(item.estoqueMinimo ?? 0);
    return disponivel > 0 && disponivel <= minimo;
  });
}

export function filterProductsControlled(items: ProductListItem[]) {
  return items.filter(
    (item) => toText(item.tipoDispensacao, "VENDA_LIVRE") !== "VENDA_LIVRE",
  );
}

export function groupProductsByField(
  items: ProductListItem[],
  field: string,
): ReportSectionTable {
  const groups = new Map<string, ProductListItem[]>();
  for (const item of items) {
    const key = toText(item[field], "Sem classificacao");
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }

  const rows = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, group]) => [label, group.length, formatCurrency(sumStock(group))]);

  return {
    title: "Resumo por grupo",
    columns: ["Grupo", "Produtos", "Stock total"],
    rows,
  };
}

function sumStock(items: ProductListItem[]) {
  return items.reduce((sum, item) => sum + Number(item.estoqueAtual ?? 0), 0);
}
