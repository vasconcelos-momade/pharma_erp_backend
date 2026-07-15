import {
  getLoteQuantidadeFromMovements,
  loteQuantidadeDisponivelFromTotal,
} from "./lote-stock.service";

type LoteWithStock = {
  id: bigint;
  quantidadeQuarentena?: unknown;
  stockBalance?: {
    quantidadeTotal?: unknown;
    quantidadeDisponivel?: unknown;
    lastUpdated?: Date;
  } | null;
};

/**
 * Preenche stock a partir da soma de deltas de EstoqueMovimento por lote.
 * Não usa o último estoqueFinal (pode estar ao nível do produto).
 */
export async function enrichLotesStockFromMovements(
  tx: unknown,
  lotes: LoteWithStock[],
): Promise<void> {
  if (lotes.length === 0) {
    return;
  }

  for (const lote of lotes) {
    const total = await getLoteQuantidadeFromMovements(tx as never, lote.id);
    lote.stockBalance = {
      quantidadeTotal: total,
      quantidadeDisponivel: loteQuantidadeDisponivelFromTotal(
        total,
        lote.quantidadeQuarentena,
      ),
    };
  }
}
