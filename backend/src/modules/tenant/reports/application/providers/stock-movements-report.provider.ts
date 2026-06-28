import { ListStockMovementsUseCase } from "../../../stock/application/use-cases/list-stock-movements.use-case";
import { collectAllPages } from "../helpers/report-pagination.helper";
import { toText } from "../helpers/report-export.helper";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";
import { REPORT_KEYS, type ReportKey } from "../constants/report-keys";
import {
  buildStockReportDefinition,
  mapMovementRows,
  movementTableColumns,
  parseStockMovementFilters,
} from "./helpers/stock-report.builder";

abstract class BaseStockMovementsReportProvider implements ReportDataProvider {
  abstract readonly reportKey: ReportKey;
  readonly fixedTipo: string | undefined = undefined;
  abstract readonly reportTitle: string;
  abstract readonly fileBaseName: string;

  protected readonly listUseCase = new ListStockMovementsUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseStockMovementFilters(context.url);
    const tipo = this.fixedTipo ?? filters.tipo;

    const [firstPage, items] = await Promise.all([
      this.listUseCase.execute({ ...filters, tipo, page: 1, pageSize: 1 }),
      collectAllPages<Record<string, unknown>>((page) =>
        this.listUseCase.execute({ ...filters, tipo, page, pageSize: 100 }).then((result) => ({
          items: result.items as Array<Record<string, unknown>>,
          hasMore: result.hasMore,
        })),
      ),
    ]);

    const overview = firstPage.overview;

    return buildStockReportDefinition({
      fileBaseName: this.fileBaseName,
      reportName: this.reportTitle,
      title: this.reportTitle,
      filters: {
        Pesquisa: filters.q ?? "-",
        Tipo: tipo ?? "Todos",
        Origem: filters.origem ?? "-",
        De: filters.dataInicio ?? "-",
        Ate: filters.dataFim ?? "-",
      },
      kpis: {
        Movimentos: overview.totalMovimentos,
        Entradas: overview.entradas.count,
        Saidas: overview.saidas.count,
        Ajustes: overview.ajustes.count,
        "No relatorio": items.length,
      },
      tables: [
        {
          title: this.reportTitle,
          columns: movementTableColumns,
          rows: mapMovementRows(items),
        },
      ],
      totals: {
        Registos: items.length,
        "Qtd total": items.reduce(
          (sum, item) => sum + Number(item.quantidade ?? 0),
          0,
        ),
      },
    });
  }
}

export class StockMovementsReportProvider extends BaseStockMovementsReportProvider {
  readonly reportKey = REPORT_KEYS.STOCK_MOVEMENTS;
  readonly reportTitle = "Movimentos de Stock";
  readonly fileBaseName = "movimentos-stock";
}

export class StockMovementsEntradaReportProvider extends BaseStockMovementsReportProvider {
  readonly reportKey = REPORT_KEYS.STOCK_MOVEMENTS_ENTRADA;
  readonly fixedTipo = "ENTRADA";
  readonly reportTitle = "Entradas de Stock";
  readonly fileBaseName = "entradas-stock";
}

export class StockMovementsSaidaReportProvider extends BaseStockMovementsReportProvider {
  readonly reportKey = REPORT_KEYS.STOCK_MOVEMENTS_SAIDA;
  readonly fixedTipo = "SAIDA";
  readonly reportTitle = "Saidas de Stock";
  readonly fileBaseName = "saidas-stock";
}

export class StockMovementsAjusteReportProvider extends BaseStockMovementsReportProvider {
  readonly reportKey = REPORT_KEYS.STOCK_MOVEMENTS_AJUSTE;
  readonly fixedTipo = "AJUSTE";
  readonly reportTitle = "Ajustes de Stock";
  readonly fileBaseName = "ajustes-stock";
}
