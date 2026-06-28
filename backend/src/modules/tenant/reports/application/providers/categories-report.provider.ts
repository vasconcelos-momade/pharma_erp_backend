import { CategoriaService } from "../../../products/application/services/categoria.service";
import { collectAllPages } from "../helpers/report-pagination.helper";
import { toText } from "../helpers/report-export.helper";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";
import { buildProductReportDefinition } from "./helpers/pharmacy-report.builder";
import { REPORT_KEYS } from "../constants/report-keys";

export class CategoriesReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.CATEGORIES;

  private readonly categoriaService = new CategoriaService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = context.url.searchParams;
    const search = query.get("q")?.trim() || query.get("search")?.trim() || undefined;
    const includeInactive = query.get("includeInactive") === "true";

    const [items, stats] = await Promise.all([
      collectAllPages((page) =>
        this.categoriaService.search({
          query: search,
          includeInactive,
          page,
          pageSize: 100,
        }),
      ),
      this.categoriaService.getStats(),
    ]);

    return buildProductReportDefinition({
      fileBaseName: "relatorio-categorias",
      reportName: "Relatorio de Categorias",
      title: "Relatorio de Categorias",
      filters: {
        Pesquisa: search ?? "-",
        "Incluir inactivas": includeInactive ? "Sim" : "Nao",
      },
      kpis: {
        Categorias: stats.totalCategorias,
        Produtos: stats.totalProdutos,
        Activas: stats.categoriasActivas,
        Inactivas: stats.categoriasInactivas,
        "Stock disponivel": stats.stockDisponivel,
      },
      tables: [
        {
          title: "Categorias",
          columns: ["Nome", "Descricao", "Produtos", "Activos", "Inactivos", "Stock", "Estado"],
          rows: items.map((item: any) => [
            toText(item.nome),
            toText(item.descricao),
            toText(item.productCount ?? item.totalProdutos, "0"),
            "-",
            "-",
            "-",
            item.ativo === false ? "Inactiva" : "Activa",
          ]),
        },
        {
          title: "Resumo por categoria (stats)",
          columns: ["Categoria", "Produtos", "Activos", "Inactivos", "Stock"],
          rows: stats.items.map((item: any) => [
            toText(item.nome),
            toText(item.totalProdutos, "0"),
            toText(item.produtosActivos, "0"),
            toText(item.produtosInactivos, "0"),
            toText(item.stockDisponivel, "0"),
          ]),
        },
      ],
      totals: { Registos: items.length },
    });
  }
}
