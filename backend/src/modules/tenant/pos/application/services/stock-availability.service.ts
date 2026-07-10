import {
  getLoteQuantidadeDisponivel,
  type LoteStockTx,
} from "../../../stock/domain/lote-stock.service";
import { readLoteDisponivel } from "../../../stock/domain/lote-stock-read.util";

type StockBalanceRow = {
  quantidadeDisponivel?: unknown;
} | null;

export type LoteStockRow = {
  id?: bigint;
  quantidadeQuarentena?: unknown;
  stockBalance?: StockBalanceRow;
};

type ProductStockRow = {
  stockBalance?: StockBalanceRow;
  lotes?: LoteStockRow[];
};

/**
 * Lê disponibilidade com StockBalance / LoteStockBalance como fonte principal.
 * Recalcula movimentos apenas quando o cache está ausente ou a zero.
 */
export class StockAvailabilityService {
  readProductAvailable(produto: ProductStockRow): number {
    return Math.max(
      0,
      Number(produto.stockBalance?.quantidadeDisponivel ?? 0) || 0,
    );
  }

  readLoteAvailable(lote: LoteStockRow): number {
    return readLoteDisponivel(lote);
  }

  hasSellableStock(produto: ProductStockRow): boolean {
    const lotes = produto.lotes ?? [];
    if (lotes.some((lote) => this.readLoteAvailable(lote) > 0)) {
      return true;
    }
    return this.readProductAvailable(produto) > 0 && lotes.length > 0;
  }

  async readLoteAvailableAsync(
    tx: LoteStockTx,
    lote: LoteStockRow,
  ): Promise<number> {
    const cached = this.readLoteAvailable(lote);
    if (cached > 0) {
      return cached;
    }
    if (lote.id === undefined) {
      return 0;
    }
    return getLoteQuantidadeDisponivel(tx, lote as { id: bigint; quantidadeQuarentena?: unknown });
  }

  async readProductAvailableAsync(
    tx: LoteStockTx,
    produto: ProductStockRow,
    lotes: LoteStockRow[],
  ): Promise<number> {
    const cached = this.readProductAvailable(produto);
    if (cached > 0) {
      return cached;
    }

    let sum = 0;
    for (const lote of lotes) {
      sum += await this.readLoteAvailableAsync(tx, lote);
    }
    return sum;
  }

  async hasSellableStockAsync(
    tx: LoteStockTx,
    produto: ProductStockRow,
    lotes: LoteStockRow[],
  ): Promise<boolean> {
    for (const lote of lotes) {
      if ((await this.readLoteAvailableAsync(tx, lote)) > 0) {
        return true;
      }
    }
    return false;
  }
}
