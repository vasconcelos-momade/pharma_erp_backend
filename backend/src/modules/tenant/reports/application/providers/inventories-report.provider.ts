import { GetInventoryDetailUseCase } from "../../../stock/application/use-cases/inventory/get-inventory-detail.use-case";
import { ListInventoriesUseCase } from "../../../stock/application/use-cases/inventory/list-inventories.use-case";
import { ListInventoryItemsUseCase } from "../../../stock/application/use-cases/inventory/list-inventory-items.use-case";
import { collectAllPages } from "../helpers/report-pagination.helper";
import { toText } from "../helpers/report-export.helper";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";
import { buildStockReportDefinition, formatDateTime } from "./helpers/stock-report.builder";
import { REPORT_KEYS } from "../constants/report-keys";

export class InventoriesListReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.INVENTORIES;

  private readonly listUseCase = new ListInventoriesUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const status = context.url.searchParams.get("status")?.trim() as
      | "ABERTO"
      | "EM_CONTAGEM"
      | "RECONCILIADO"
      | "CANCELADO"
      | undefined;

    const items = await this.listUseCase.execute(status ? { status } : {});

    return buildStockReportDefinition({
      fileBaseName: "inventarios",
      reportName: "Inventarios",
      title: "Inventarios de Stock",
      filters: { Estado: status ?? "Todos" },
      kpis: {
        Total: items.length,
        Abertos: items.filter((item: any) => item.status === "ABERTO").length,
        "Em contagem": items.filter((item: any) => item.status === "EM_CONTAGEM").length,
        Reconciliados: items.filter((item: any) => item.status === "RECONCILIADO").length,
      },
      tables: [
        {
          title: "Sessoes de inventario",
          columns: [
            "Codigo",
            "Estado",
            "Itens",
            "Divergencias",
            "Iniciado por",
            "Iniciado em",
            "Reconciliado em",
          ],
          rows: items.map((item: any) => [
            toText(item.codigo),
            toText(item.status),
            toText(item.totalItens, "0"),
            toText(item.itensComDivergencia, "0"),
            toText(item.iniciadoPorNome),
            formatDateTime(item.iniciadoEm),
            formatDateTime(item.reconciliadoEm),
          ]),
        },
      ],
      totals: { Registos: items.length },
    });
  }
}

export class InventoryDetailReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.INVENTORY_DETAIL;

  private readonly detailUseCase = new GetInventoryDetailUseCase();
  private readonly itemsUseCase = new ListInventoryItemsUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const inventarioId =
      context.routeParams.inventarioId ??
      context.url.searchParams.get("inventarioId")?.trim();
    if (!inventarioId) {
      throw new Error("inventarioId e obrigatorio");
    }

    const query = context.url.searchParams.get("q")?.trim() || undefined;
    const nomeGenerico =
      context.url.searchParams.get("nomeGenerico")?.trim() || undefined;
    const forma = context.url.searchParams.get("forma")?.trim() || undefined;
    const fornecedorNome =
      context.url.searchParams.get("fornecedorNome")?.trim() || undefined;

    const [detail, items] = await Promise.all([
      this.detailUseCase.execute(inventarioId),
      collectAllPages((page) =>
        this.itemsUseCase.execute({
          inventarioId,
          query,
          nomeGenerico,
          forma,
          fornecedorNome,
          page,
          pageSize: 100,
        }),
      ),
    ]);

    return buildStockReportDefinition({
      fileBaseName: `inventario-${detail.codigo ?? inventarioId}`,
      reportName: "Detalhe de Inventario",
      title: `Inventario ${detail.codigo ?? inventarioId}`,
      subtitle: toText(detail.observacao),
      filters: {
        Codigo: detail.codigo ?? "-",
        Estado: detail.status ?? "-",
        Pesquisa: query ?? "-",
      },
      kpis: {
        Itens: items.length,
        Divergencias: items.filter((item: any) => Number(item.divergencia ?? 0) !== 0).length,
        "Stock sistema": items.reduce(
          (sum, item: any) => sum + Number(item.estoqueSistema ?? 0),
          0,
        ),
        "Stock contado": items.reduce(
          (sum, item: any) => sum + Number(item.estoqueContado ?? 0),
          0,
        ),
      },
      tables: [
        {
          title: "Itens do inventario",
          columns: [
            "Produto",
            "Lote",
            "Validade",
            "Sistema",
            "Contado",
            "Divergencia",
            "Fornecedor",
          ],
          rows: items.map((item: any) => [
            toText(item.produtoNomeComercial ?? item.produto?.nomeComercial),
            toText(item.numeroLote ?? item.lote?.numeroLote),
            formatDateTime(item.dataValidade ?? item.lote?.dataValidade),
            toText(item.estoqueSistema, "0"),
            toText(item.estoqueContado, "0"),
            toText(item.divergencia, "0"),
            toText(item.fornecedorNome ?? item.lote?.fornecedor?.nome),
          ]),
        },
      ],
      totals: { Registos: items.length },
    });
  }
}
