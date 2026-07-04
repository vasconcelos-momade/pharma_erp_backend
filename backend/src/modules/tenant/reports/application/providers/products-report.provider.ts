import { ProdutoService } from "../../../products/application/services/produto.service";
import { CategoriaService } from "../../../products/application/services/categoria.service";
import {
  SearchValidadesUseCase,
  ValidadesDashboardUseCase,
} from "../../../stock/application/use-cases/lotes/validades.use-case";
import { collectAllPages } from "../helpers/report-pagination.helper";
import { formatCurrency, toText } from "../helpers/report-export.helper";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";
import { REPORT_KEYS, type ReportKey } from "../constants/report-keys";
import {
  buildProductReportDefinition,
  filterProductsBelowMinStock,
  filterProductsControlled,
  filterProductsNoStock,
  formatDateTime,
  groupProductsByField,
  parseProductSearchFilters,
  productTable,
  type ProductListItem,
} from "./helpers/pharmacy-report.builder";

abstract class BaseProductsReportProvider implements ReportDataProvider {
  abstract readonly reportKey: ReportKey;

  protected readonly produtoService = new ProdutoService();

  protected async loadProducts(context: ReportProviderContext): Promise<ProductListItem[]> {
    const filters = parseProductSearchFilters(context.url);
    return collectAllPages((page) =>
      this.produtoService.search({
        query: filters.search,
        categoriaId: filters.categoriaId,
        fornecedorId: filters.fornecedorId,
        tipoDispensacao: filters.tipoDispensacao,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        includeInactive: filters.includeInactive,
        page,
        pageSize: 100,
      }),
    );
  }

  abstract build(context: ReportProviderContext): Promise<ModuleReportDefinition>;
}

export class ProductsCatalogReportProvider extends BaseProductsReportProvider {
  readonly reportKey = REPORT_KEYS.PRODUCTS_CATALOG;

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseProductSearchFilters(context.url);
    const [items, dashboard] = await Promise.all([
      this.loadProducts(context),
      this.produtoService.getDashboard(),
    ]);

    return buildProductReportDefinition({
      fileBaseName: "catalogo-produtos",
      reportName: "Catalogo de Produtos",
      title: "Catalogo de Produtos",
      subtitle: "Listagem master do catalogo farmaceutico",
      filters: {
        Pesquisa: filters.search ?? "-",
        Categoria: filters.categoriaId ?? "-",
        Fornecedor: filters.fornecedorId ?? "-",
        Regulacao: filters.tipoDispensacao ?? "-",
      },
      kpis: {
        "Total de produtos": items.length,
        Activos: dashboard.produtosActivos ?? items.filter((i) => i.ativo !== false).length,
        "Sem stock": dashboard.produtosSemStock ?? filterProductsNoStock(items).length,
        "Stock baixo": dashboard.produtosStockBaixo ?? filterProductsBelowMinStock(items).length,
        Controlados: dashboard.produtosControlados ?? filterProductsControlled(items).length,
      },
      tables: [productTable("Produtos", items)],
      totals: { Registos: items.length },
    });
  }
}

export class ProductsByCategoryReportProvider extends BaseProductsReportProvider {
  readonly reportKey = REPORT_KEYS.PRODUCTS_BY_CATEGORY;

  private readonly categoriaService = new CategoriaService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseProductSearchFilters(context.url);
    const stats = await this.categoriaService.getStats();

    const productItems = filters.categoriaId
      ? await this.loadProducts(context)
      : [];

    const tables: ModuleReportDefinition["tables"] = [
      {
        title: "Produtos por categoria",
        columns: ["Categoria", "Produtos", "Activos", "Inactivos", "Stock"],
        rows: stats.items.map((item: any) => [
          toText(item.nome),
          toText(item.totalProdutos, "0"),
          toText(item.produtosActivos, "0"),
          toText(item.produtosInactivos, "0"),
          toText(item.stockDisponivel, "0"),
        ]),
      },
    ];

    if (productItems.length > 0) {
      tables.push(productTable("Detalhe da categoria", productItems));
    }

    return buildProductReportDefinition({
      fileBaseName: "produtos-por-categoria",
      reportName: "Produtos por Categoria",
      title: "Produtos por Categoria",
      filters: {
        Categoria: filters.categoriaId ?? "Todas",
        Pesquisa: filters.search ?? "-",
      },
      kpis: {
        Categorias: stats.totalCategorias,
        Produtos: stats.totalProdutos,
        "Stock disponivel": stats.stockDisponivel,
      },
      tables,
      totals: { Categorias: stats.items.length },
    });
  }
}

export class ProductsBySupplierReportProvider extends BaseProductsReportProvider {
  readonly reportKey = REPORT_KEYS.PRODUCTS_BY_SUPPLIER;

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseProductSearchFilters(context.url);
    const items = await this.loadProducts(context);

    return buildProductReportDefinition({
      fileBaseName: "produtos-por-fornecedor",
      reportName: "Produtos por Fornecedor",
      title: "Produtos por Fornecedor",
      filters: {
        Fornecedor: filters.fornecedorId ?? "Todos",
        Pesquisa: filters.search ?? "-",
      },
      kpis: { "Total de produtos": items.length },
      tables: [productTable("Produtos do fornecedor", items)],
      totals: { Registos: items.length },
    });
  }
}

export class ProductsBySubstanciaReportProvider extends BaseProductsReportProvider {
  readonly reportKey = REPORT_KEYS.PRODUCTS_BY_SUBSTANCIA;

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseProductSearchFilters(context.url);
    const items = await this.loadProducts(context);

    return buildProductReportDefinition({
      fileBaseName: "produtos-por-substancia",
      reportName: "Produtos por Substancia Activa",
      title: "Produtos por Substancia Activa",
      subtitle: "Agrupamento por substancia activa do catalogo",
      filters: { Pesquisa: filters.search ?? "-" },
      kpis: {
        "Total de produtos": items.length,
        "Substancias distintas": new Set(
          items.map((item) => toText(item.nomeGenerico, "Sem classificacao")),
        ).size,
      },
      tables: [
        groupProductsByField(items, "nomeGenerico"),
        productTable("Detalhe de produtos", items),
      ],
      totals: { Registos: items.length },
    });
  }
}

export class ProductsNoStockReportProvider extends BaseProductsReportProvider {
  readonly reportKey = REPORT_KEYS.PRODUCTS_NO_STOCK;

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const items = filterProductsNoStock(await this.loadProducts(context));
    return buildProductReportDefinition({
      fileBaseName: "produtos-sem-stock",
      reportName: "Produtos sem Stock",
      title: "Produtos sem Stock",
      filters: { Criterio: "Stock disponivel <= 0" },
      kpis: { "Produtos sem stock": items.length },
      tables: [productTable("Produtos sem stock", items)],
      totals: { Registos: items.length },
    });
  }
}

export class ProductsBelowMinStockReportProvider extends BaseProductsReportProvider {
  readonly reportKey = REPORT_KEYS.PRODUCTS_BELOW_MIN_STOCK;

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const items = filterProductsBelowMinStock(await this.loadProducts(context));
    return buildProductReportDefinition({
      fileBaseName: "produtos-abaixo-minimo",
      reportName: "Produtos abaixo do Stock Minimo",
      title: "Produtos abaixo do Stock Minimo",
      filters: { Criterio: "Stock > 0 e stock <= minimo" },
      kpis: { "Produtos em alerta": items.length },
      tables: [productTable("Produtos abaixo do minimo", items)],
      totals: { Registos: items.length },
    });
  }
}

export class ProductsControlledReportProvider extends BaseProductsReportProvider {
  readonly reportKey = REPORT_KEYS.PRODUCTS_CONTROLLED;

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseProductSearchFilters(context.url);
    const items = filterProductsControlled(await this.loadProducts(context));
    return buildProductReportDefinition({
      fileBaseName: "produtos-controlados",
      reportName: "Produtos Controlados",
      title: "Produtos Controlados",
      filters: {
        Regulacao: filters.tipoDispensacao ?? "Diferente de venda livre",
      },
      kpis: { "Produtos controlados": items.length },
      tables: [productTable("Produtos controlados", items)],
      totals: { Registos: items.length },
    });
  }
}

export class ProductsNearExpiryReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.PRODUCTS_NEAR_EXPIRY;

  private readonly searchUseCase = new SearchValidadesUseCase();
  private readonly dashboardUseCase = new ValidadesDashboardUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = context.url.searchParams;
    const q = query.get("q")?.trim() || undefined;
    const bucket = query.get("bucket") === "60" ? "60" : "30";

    const [dashboard, items] = await Promise.all([
      this.dashboardUseCase.execute(),
      collectAllPages<Record<string, unknown>>((page) =>
        this.searchUseCase.execute({
          q,
          bucket,
          page,
          pageSize: 100,
        }) as Promise<{ items: Array<Record<string, unknown>>; hasMore: boolean }>,
      ),
    ]);

    return buildProductReportDefinition({
      fileBaseName: `produtos-proximos-validade-${bucket}`,
      reportName: "Produtos proximos da validade",
      title: "Produtos proximos da validade",
      filters: { Pesquisa: q ?? "-", Janela: bucket === "60" ? "Ate 60 dias" : "Ate 30 dias" },
      kpis: {
        "30 dias": dashboard.expiramEm30Dias,
        "60 dias": dashboard.expiramEm60Dias,
        Lotes: items.length,
      },
      tables: [
        {
          title: "Lotes proximos da validade",
          columns: ["Produto", "Lote", "Validade", "Dias", "Qtd", "Estado"],
          rows: items.map((item) => [
            toText(item.produtoNomeComercial),
            toText(item.numeroLote),
            toText(item.dataValidade),
            toText(item.diasRestantes),
            toText(item.quantidadeDisponivel, "0"),
            toText(item.estado),
          ]),
        },
      ],
      totals: { Lotes: items.length },
    });
  }
}

export class ProductsExpiredReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.PRODUCTS_EXPIRED;

  private readonly searchUseCase = new SearchValidadesUseCase();
  private readonly dashboardUseCase = new ValidadesDashboardUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const q = context.url.searchParams.get("q")?.trim() || undefined;
    const [dashboard, items] = await Promise.all([
      this.dashboardUseCase.execute(),
      collectAllPages<Record<string, unknown>>((page) =>
        this.searchUseCase.execute({
          q,
          bucket: "expirado",
          page,
          pageSize: 100,
        }) as Promise<{ items: Array<Record<string, unknown>>; hasMore: boolean }>,
      ),
    ]);

    return buildProductReportDefinition({
      fileBaseName: "produtos-expirados",
      reportName: "Produtos expirados",
      title: "Produtos expirados",
      filters: { Pesquisa: q ?? "-" },
      kpis: {
        "Lotes expirados": dashboard.lotesExpirados,
        "Valor em risco (MZN)": formatCurrency(dashboard.valorFinanceiroEmRisco),
      },
      tables: [
        {
          title: "Lotes expirados",
          columns: ["Produto", "Lote", "Validade", "Qtd", "Valor", "Estado"],
          rows: items.map((item) => [
            toText(item.produtoNomeComercial),
            toText(item.numeroLote),
            formatDateTime(item.dataValidade),
            toText(item.quantidadeDisponivel, "0"),
            formatCurrency(item.valorEmStock),
            toText(item.estado),
          ]),
        },
      ],
      totals: { Lotes: items.length },
    });
  }
}
