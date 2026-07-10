import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { buildFefoLoteWhereForPosCandidates } from "../../../stock/domain/fefo-lote.service";
import type { LoteStockTx } from "../../../stock/domain/lote-stock.service";
import { resolveRegulacaoPolicyForProduto } from "../../../products/domain/produto-presenter";
import {
  posFefoLoteEnrichmentSelect,
} from "../../domain/pos-catalog.query";
import type {
  PosCategoriaProjection,
  PosLoteProjection,
  PosProductProjection,
  PosTaxRuleProjection,
} from "../../domain/pos-product-projection";
import { FefoSelectionService } from "./fefo-selection.service";
import { PricingService } from "./pricing.service";
import {
  StockAvailabilityService,
  type LoteStockRow,
} from "./stock-availability.service";

type RawLoteRow = LoteStockRow & {
  numeroLote?: string;
  dataValidade?: Date;
  precoVenda?: unknown;
};

type RawProductRow = Record<string, unknown> & {
  id?: bigint;
  nomeComercial?: string;
  nomeGenerico?: string | null;
  barcode?: string | null;
  categoriaId?: bigint | null;
  categoria?: PosCategoriaProjection | null;
  dosagem?: string | null;
  forma?: string | null;
  apresentacao?: string | null;
  ativo?: boolean;
  taxRule?: PosTaxRuleProjection | null;
  regulacao?: PosProductProjection["regulacao"];
  stockBalance?: { quantidadeDisponivel?: unknown } | null;
  lotes?: RawLoteRow[];
};

/** Mapeia linhas Prisma do catálogo POS para projeção e resposta API. */
export class PosProductMapper {
  constructor(
    private readonly stock = new StockAvailabilityService(),
    private readonly fefo = new FefoSelectionService(),
    private readonly pricing = new PricingService(),
  ) {}

  async fromProdutoRowAsync(
    tx: LoteStockTx,
    row: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const enriched = await this.enrichRow(tx, row as RawProductRow);
    if (!enriched) {
      return null;
    }
    return this.fromProdutoRow(enriched);
  }

  fromProdutoRow(row: Record<string, unknown>): Record<string, unknown> | null {
    const projection = this.toProjection(row as RawProductRow);
    if (!projection) {
      return null;
    }
    return this.toApiResponse(projection);
  }

  private async enrichRow(
    tx: LoteStockTx,
    row: RawProductRow,
  ): Promise<RawProductRow | null> {
    if (row.id === undefined) {
      return null;
    }

    let lotes = await this.enrichLotes(tx, row.lotes ?? []);
    if (!(await this.stock.hasSellableStockAsync(tx, row, lotes))) {
      const prisma = tx as ReturnType<typeof getPrisma>;
      const allLotes = await prisma.lote.findMany({
        where: {
          produtoId: row.id,
          ...buildFefoLoteWhereForPosCandidates(),
        },
        orderBy: [{ dataValidade: "asc" }, { createdAt: "asc" }],
        select: posFefoLoteEnrichmentSelect,
      });
      lotes = await this.enrichLotes(tx, allLotes as RawLoteRow[]);
    }

    const sellableLotes = this.fefo.selectSellableLotes(lotes);
    if (!sellableLotes.length) {
      return null;
    }

    const estoqueAtual = await this.stock.readProductAvailableAsync(
      tx,
      row,
      sellableLotes,
    );
    if (estoqueAtual <= 0) {
      return null;
    }

    return {
      ...row,
      stockBalance: { quantidadeDisponivel: estoqueAtual },
      lotes: sellableLotes,
    };
  }

  private async enrichLotes(
    tx: LoteStockTx,
    lotes: RawLoteRow[],
  ): Promise<RawLoteRow[]> {
    const enriched: RawLoteRow[] = [];
    for (const lote of lotes) {
      const quantidadeDisponivel = await this.stock.readLoteAvailableAsync(
        tx,
        lote,
      );
      enriched.push({
        ...lote,
        stockBalance: { quantidadeDisponivel },
      });
    }
    return enriched;
  }

  toProjection(row: RawProductRow): PosProductProjection | null {
    if (!this.stock.hasSellableStock(row)) {
      return null;
    }

    const lotes = row.lotes ?? [];
    const sellableLotes = this.fefo.selectSellableLotes(lotes);
    const primaryLote = this.fefo.pickPrimaryLote(lotes);
    const nomeComercial =
      typeof row.nomeComercial === "string" ? row.nomeComercial : "";

    const categoria =
      row.categoria && row.categoria.id !== undefined
        ? {
            id: row.categoria.id,
            nome: row.categoria.nome ?? "",
            codigoFNM: row.categoria.codigoFNM ?? null,
            descricao: row.categoria.descricao ?? null,
            ativo: row.categoria.ativo ?? true,
            createdAt: row.categoria.createdAt,
            updatedAt: row.categoria.updatedAt,
          }
        : null;

    const policy = resolveRegulacaoPolicyForProduto({
      regulacao: row.regulacao,
      categoria,
    });

    const fefoLotes: PosLoteProjection[] = sellableLotes
      .filter(
        (lote): lote is RawLoteRow & { id: bigint; numeroLote: string; dataValidade: Date } =>
          lote.id !== undefined &&
          typeof lote.numeroLote === "string" &&
          lote.dataValidade instanceof Date,
      )
      .map((lote) => ({
        id: lote.id,
        numeroLote: lote.numeroLote,
        dataValidade: lote.dataValidade,
        quantidadeDisponivel: this.stock.readLoteAvailable(lote),
        precoVenda: this.pricing.resolveSalePrice(lote, nomeComercial),
      }));

    return {
      id: row.id!,
      nomeComercial,
      nomeGenerico: row.nomeGenerico ?? null,
      barcode: row.barcode ?? null,
      categoriaId: row.categoriaId ?? null,
      categoria,
      categoriaNome: categoria?.nome ?? null,
      categoriaCodigoFNM: categoria?.codigoFNM ?? null,
      dosagem: row.dosagem ?? null,
      forma: row.forma ?? null,
      apresentacao: row.apresentacao ?? null,
      ativo: row.ativo ?? true,
      taxRule: row.taxRule ?? null,
      regulacao: row.regulacao ?? null,
      estoqueAtual: this.stock.readProductAvailable(row),
      precoVenda: this.pricing.resolveSalePrice(primaryLote, nomeComercial),
      lote: primaryLote?.numeroLote ?? null,
      dataValidade: primaryLote?.dataValidade?.toISOString() ?? null,
      fefoLotes,
      ...policy,
    };
  }

  toApiResponse(projection: PosProductProjection): Record<string, unknown> {
    const { fefoLotes: _fefoLotes, ...api } = projection;
    return api;
  }
}
