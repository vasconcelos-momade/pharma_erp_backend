import { GetRequisitionDetailUseCase } from "../../../stock/application/use-cases/requisitions/get-requisition-detail.use-case";
import { ListRequisitionsUseCase } from "../../../stock/application/use-cases/requisitions/list-requisitions.use-case";
import { formatCurrency, toText } from "../helpers/report-export.helper";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";
import { REPORT_KEYS, type ReportKey } from "../constants/report-keys";
import {
  buildStockReportDefinition,
  formatDateTime,
  parseRequisitionFilters,
} from "./helpers/stock-report.builder";

abstract class BaseRequisitionsListReportProvider implements ReportDataProvider {
  abstract readonly reportKey: ReportKey;
  readonly fixedTipo: "COMPRA" | "ENTRADA" | "SAIDA" | undefined = undefined;
  abstract readonly reportTitle: string;
  abstract readonly fileBaseName: string;
  abstract readonly transfersOnly: boolean;

  protected readonly listUseCase = new ListRequisitionsUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseRequisitionFilters(context.url);
    const tipo = this.fixedTipo ?? (filters.tipo as "COMPRA" | "ENTRADA" | "SAIDA" | undefined);

    let items = await this.listUseCase.execute({
      status: filters.status as any,
      tipo,
      origem: filters.origem,
      destino: filters.destino,
      fornecedorId: filters.fornecedorId,
    });

    if (this.transfersOnly) {
      items = items.filter(
        (item: any) =>
          Boolean(item.origem?.trim()) && Boolean(item.destino?.trim()),
      );
    }

    return buildStockReportDefinition({
      fileBaseName: this.fileBaseName,
      reportName: this.reportTitle,
      title: this.reportTitle,
      filters: {
        Tipo: tipo ?? (this.transfersOnly ? "Transferencia" : "Todos"),
        Estado: filters.status ?? "-",
        Origem: filters.origem ?? "-",
        Destino: filters.destino ?? "-",
        Fornecedor: filters.fornecedorId ?? "-",
      },
      kpis: {
        Requisicoes: items.length,
        Pendentes: items.filter((item: any) => item.status === "PENDENTE").length,
        Concluidas: items.filter((item: any) => item.status === "CONCLUIDA").length,
        "Qtd total": items.reduce(
          (sum: number, item: any) => sum + Number(item.quantidadeTotal ?? 0),
          0,
        ),
      },
      tables: [
        {
          title: this.reportTitle,
          columns: [
            "Documento",
            "Tipo",
            "Estado",
            "Origem",
            "Destino",
            "Fornecedor",
            "Itens",
            "Qtd",
            "Total (MZN)",
            "Criado em",
          ],
          rows: items.map((item: any) => [
            toText(item.numeroDocumento),
            toText(item.tipo),
            toText(item.status),
            toText(item.origem),
            toText(item.destino),
            toText(item.fornecedorNome),
            toText(item.totalItens, "0"),
            toText(item.quantidadeTotal, "0"),
            formatCurrency(item.total),
            formatDateTime(item.createdAt),
          ]),
        },
      ],
      totals: { Registos: items.length },
    });
  }
}

export class RequisitionsListReportProvider extends BaseRequisitionsListReportProvider {
  readonly reportKey = REPORT_KEYS.REQUISITIONS;
  readonly reportTitle = "Requisicoes de Stock";
  readonly fileBaseName = "requisicoes-stock";
  readonly transfersOnly = false;
}

export class RequisitionsCompraReportProvider extends BaseRequisitionsListReportProvider {
  readonly reportKey = REPORT_KEYS.REQUISITIONS_COMPRA;
  readonly fixedTipo = "COMPRA";
  readonly reportTitle = "Requisicoes de Compra";
  readonly fileBaseName = "requisicoes-compra";
  readonly transfersOnly = false;
}

export class RequisitionsEntradaReportProvider extends BaseRequisitionsListReportProvider {
  readonly reportKey = REPORT_KEYS.REQUISITIONS_ENTRADA;
  readonly fixedTipo = "ENTRADA";
  readonly reportTitle = "Entradas de Stock";
  readonly fileBaseName = "requisicoes-entrada";
  readonly transfersOnly = false;
}

export class RequisitionsSaidaReportProvider extends BaseRequisitionsListReportProvider {
  readonly reportKey = REPORT_KEYS.REQUISITIONS_SAIDA;
  readonly fixedTipo = "SAIDA";
  readonly reportTitle = "Saidas de Stock";
  readonly fileBaseName = "requisicoes-saida";
  readonly transfersOnly = false;
}

export class RequisitionsTransferReportProvider extends BaseRequisitionsListReportProvider {
  readonly reportKey = REPORT_KEYS.REQUISITIONS_TRANSFER;
  readonly reportTitle = "Transferencias de Stock";
  readonly fileBaseName = "transferencias-stock";
  readonly transfersOnly = true;
}

export class RequisitionDetailReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.REQUISITION_DETAIL;

  private readonly detailUseCase = new GetRequisitionDetailUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const requisicaoId =
      context.routeParams.requisicaoId ??
      context.url.searchParams.get("requisicaoId")?.trim();
    if (!requisicaoId) {
      throw new Error("requisicaoId e obrigatorio");
    }

    const detail = await this.detailUseCase.execute(requisicaoId);

    return buildStockReportDefinition({
      fileBaseName: `requisicao-${detail.numeroDocumento ?? requisicaoId}`,
      reportName: "Detalhe de Requisicao",
      title: `Requisicao ${detail.numeroDocumento ?? requisicaoId}`,
      subtitle: toText(detail.observacao),
      filters: {
        Tipo: detail.tipo ?? "-",
        Estado: detail.status ?? "-",
        Origem: detail.origem ?? "-",
        Destino: detail.destino ?? "-",
        Fornecedor: detail.fornecedorNome ?? "-",
      },
      kpis: {
        Itens: detail.itens.length,
        Total: formatCurrency(detail.total),
        "Qtd solicitada": detail.itens.reduce(
          (sum: number, item: any) => sum + Number(item.quantidadeSolicitada ?? 0),
          0,
        ),
      },
      tables: [
        {
          title: "Itens da requisicao",
          columns: [
            "Produto",
            "Lote",
            "Validade",
            "Qtd",
            "P. compra",
            "P. venda",
            "Subtotal",
          ],
          rows: detail.itens.map((item: any) => [
            toText(item.produto?.nome),
            toText(item.lote?.numeroLote ?? item.numeroLote),
            formatDateTime(item.lote?.dataValidade ?? item.dataValidade),
            toText(item.quantidadeSolicitada, "0"),
            formatCurrency(item.precoCompra),
            formatCurrency(item.precoVenda),
            formatCurrency(item.subtotal),
          ]),
        },
      ],
      totals: { Registos: detail.itens.length },
    });
  }
}
