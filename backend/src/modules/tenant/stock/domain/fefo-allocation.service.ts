/**
 * Consumo de stock com FEFO: cria movimentos e sincroniza caches.
 */

import {
  getQuantidadeTotalFromMovements,
  syncStockBalanceCache,
  type StockTx,
} from "./produto-stock.service";
import {
  allocateFefoLotes,
  syncLoteStockBalanceCache,
  type FefoAllocation,
  type LoteStockTx,
} from "./lote-stock.service";

export type StockConsumptionInput = {
  produtoId: bigint;
  userId: bigint;
  quantidade: number;
  origem: string;
  observacoes?: string;
  idempotencyKeyPrefix: string;
};

export type StockConsumptionResult = {
  allocations: FefoAllocation[];
  estoqueFinal: number;
  totalCusto: number;
};

type ConsumptionTx = StockTx & LoteStockTx;

/**
 * Aplica FEFO, regista SAIDA por lote em EstoqueMovimento e sincroniza caches.
 * Não altera campos derivados em Lote — apenas movimentos.
 */
export async function consumeStockFefo(
  tx: ConsumptionTx,
  input: StockConsumptionInput,
): Promise<StockConsumptionResult> {
  const allocations = await allocateFefoLotes(
    tx,
    input.produtoId,
    input.quantidade,
  );

  let runningProductStock = await getQuantidadeTotalFromMovements(
    tx,
    input.produtoId,
  );
  let totalCusto = 0;

  for (const { lote, quantidade } of allocations) {
    totalCusto += Number(lote.precoCompra) * quantidade;
    const estoqueAnterior = runningProductStock;
    runningProductStock -= quantidade;

    await (tx as { estoqueMovimento: { create: (args: unknown) => Promise<unknown> } })
      .estoqueMovimento.create({
        data: {
          produtoId: input.produtoId,
          loteId: lote.id,
          userId: input.userId,
          tipo: "SAIDA",
          quantidade,
          estoqueAnterior,
          estoqueFinal: runningProductStock,
          origem: input.origem,
          idempotencyKey: `${input.idempotencyKeyPrefix}-LOTE-${lote.id}`,
          observacoes: input.observacoes,
        },
      });

    await syncLoteStockBalanceCache(tx, {
      id: lote.id,
      quantidadeQuarentena: lote.quantidadeQuarentena,
    });
  }

  await syncStockBalanceCache(tx, input.produtoId);

  return {
    allocations,
    estoqueFinal: runningProductStock,
    totalCusto,
  };
}

/**
 * Devolve stock ao anular venda: DEVOLUCAO por cada alocação FEFO.
 */
export async function restoreStockFromAllocations(
  tx: ConsumptionTx,
  input: {
    produtoId: bigint;
    userId: bigint;
    allocations: Array<{ loteId: bigint; quantidade: number; quantidadeQuarentena?: unknown }>;
    origem: string;
    observacoes?: string;
    idempotencyKeyPrefix: string;
  },
): Promise<number> {
  let runningProductStock = await getQuantidadeTotalFromMovements(
    tx,
    input.produtoId,
  );

  for (const alloc of input.allocations) {
    const estoqueAnterior = runningProductStock;
    runningProductStock += alloc.quantidade;

    await (tx as { estoqueMovimento: { create: (args: unknown) => Promise<unknown> } })
      .estoqueMovimento.create({
        data: {
          produtoId: input.produtoId,
          loteId: alloc.loteId,
          userId: input.userId,
          tipo: "DEVOLUCAO",
          quantidade: alloc.quantidade,
          estoqueAnterior,
          estoqueFinal: runningProductStock,
          origem: input.origem,
          idempotencyKey: `${input.idempotencyKeyPrefix}-LOTE-${alloc.loteId}`,
          observacoes: input.observacoes,
        },
      });

    await syncLoteStockBalanceCache(tx, {
      id: alloc.loteId,
      quantidadeQuarentena: alloc.quantidadeQuarentena,
    });
  }

  await syncStockBalanceCache(tx, input.produtoId);
  return runningProductStock;
}
