/**
 * Stock operacional: EstoqueMovimento é a fonte de verdade;
 * StockBalance / LoteStockBalance são projeções/cache de leitura.
 */

import { syncPurchaseSuggestionAfterStockChange } from "./purchase-suggestion.service";
import type { FefoLoteTx } from "./fefo-lote.service";
import {
  getLoteQuantidadeFromMovements,
  getSellableQuantityFromLoteMovements,
  syncLoteStockBalanceCache,
  type LoteStockTx,
} from "./lote-stock.service";

export type StockTx = FefoLoteTx &
  LoteStockTx & {
    stockBalance: {
      findUnique: (args: {
        where: { produtoId: bigint };
      }) => Promise<{
        quantidadeTotal: unknown;
        quantidadeReservada: unknown;
        quantidadeDisponivel: unknown;
      } | null>;
      upsert: (args: {
        where: { produtoId: bigint };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => Promise<unknown>;
      updateMany: (args: {
        where: { produtoId: bigint };
        data: Record<string, unknown>;
      }) => Promise<unknown>;
    };
    estoqueReserva?: {
      aggregate: (args: {
        where: { produtoId: bigint };
        _sum: { quantidade: true };
      }) => Promise<{ _sum: { quantidade: unknown } | null }>;
      findMany?: (args: {
        where: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) => Promise<Array<{ produtoId: bigint }>>;
    };
    estoqueMovimento?: {
      findFirst: (args: {
        where: Record<string, unknown>;
        orderBy: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
        select?: Record<string, boolean>;
      }) => Promise<{ estoqueFinal?: unknown } | null>;
      findMany?: LoteStockTx["estoqueMovimento"] extends infer T
        ? T extends { findMany: infer F }
          ? F
          : never
        : never;
      create?: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    };
    lote?: FefoLoteTx["lote"] & {
      findUnique?: (args: {
        where: { id: bigint };
        select?: Record<string, boolean>;
      }) => Promise<{ id: bigint; quantidadeQuarentena?: unknown } | null>;
    };
  };

function toNumber(value: unknown): number {
  if (value == null) {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  return Number(value) || 0;
}

/** Total físico do produto = soma dos stock por lote (fonte de verdade). */
export async function getQuantidadeTotalFromMovements(
  tx: StockTx,
  produtoId: bigint,
): Promise<number> {
  if (!tx.lote?.findMany) {
    if (!tx.estoqueMovimento?.findFirst) {
      return 0;
    }
    const latest = await tx.estoqueMovimento.findFirst({
      where: { produtoId, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { estoqueFinal: true },
    });
    return toNumber(latest?.estoqueFinal);
  }

  const lotes = await tx.lote.findMany({
    where: { produtoId, deletedAt: null },
    select: { id: true },
  });

  let total = 0;
  for (const lote of lotes) {
    total += await getLoteQuantidadeFromMovements(tx, lote.id);
  }
  return total;
}

/** Quantidade vendável (FEFO) — projeção a partir dos movimentos por lote. */
export async function getSellableQuantityFromLotes(
  tx: StockTx,
  produtoId: bigint,
): Promise<number> {
  return getSellableQuantityFromLoteMovements(tx, produtoId);
}

export async function getQuantidadeTotal(
  tx: StockTx,
  produtoId: bigint,
): Promise<number> {
  const fromMovements = await getQuantidadeTotalFromMovements(tx, produtoId);
  if (fromMovements > 0) {
    return fromMovements;
  }

  const balance = await tx.stockBalance.findUnique({
    where: { produtoId },
  });
  if (balance) {
    return toNumber(balance.quantidadeTotal);
  }

  return 0;
}

/** Reservas activas no carrinho — fonte de verdade: estoque_reservas. */
export async function getQuantidadeReservada(
  tx: StockTx,
  produtoId: bigint,
): Promise<number> {
  if (tx.estoqueReserva?.aggregate) {
    const result = await tx.estoqueReserva.aggregate({
      where: { produtoId },
      _sum: { quantidade: true },
    });
    return toNumber(result._sum?.quantidade);
  }

  const balance = await tx.stockBalance.findUnique({
    where: { produtoId },
  });
  return toNumber(balance?.quantidadeReservada);
}

export async function getQuantidadeDisponivel(
  tx: StockTx,
  produtoId: bigint,
): Promise<number> {
  const balance = await tx.stockBalance.findUnique({
    where: { produtoId },
  });
  const reservada = await getQuantidadeReservada(tx, produtoId);
  const total = await getQuantidadeTotal(tx, produtoId);
  const sellable = await getSellableQuantityFromLotes(tx, produtoId);
  const disponivel = Math.max(0, Math.min(total, sellable) - reservada);

  const cachedDisponivel = toNumber(balance?.quantidadeDisponivel);
  const cachedReservada = toNumber(balance?.quantidadeReservada);
  const cachedTotal = toNumber(balance?.quantidadeTotal);

  if (
    balance == null ||
    cachedDisponivel !== disponivel ||
    cachedReservada !== reservada ||
    cachedTotal !== total
  ) {
    await tx.stockBalance.upsert({
      where: { produtoId },
      create: {
        produtoId,
        quantidadeTotal: total,
        quantidadeReservada: reservada,
        quantidadeDisponivel: disponivel,
      },
      update: {
        quantidadeTotal: total,
        quantidadeReservada: reservada,
        quantidadeDisponivel: disponivel,
      },
    });

    await syncPurchaseSuggestionAfterStockChange(tx, produtoId, disponivel);
  }

  return disponivel;
}

/**
 * Actualiza StockBalance (cache) a partir de EstoqueMovimento + projeção FEFO.
 */
export async function syncStockBalanceCache(
  tx: StockTx,
  produtoId: bigint,
): Promise<{ total: number; disponivel: number }> {
  const total = await getQuantidadeTotalFromMovements(tx, produtoId);
  const sellable = await getSellableQuantityFromLotes(tx, produtoId);
  const reservada = await getQuantidadeReservada(tx, produtoId);
  const disponivel = Math.max(0, Math.min(total, sellable) - reservada);

  await tx.stockBalance.upsert({
    where: { produtoId },
    create: {
      produtoId,
      quantidadeTotal: total,
      quantidadeReservada: reservada,
      quantidadeDisponivel: disponivel,
    },
    update: {
      quantidadeTotal: total,
      quantidadeReservada: reservada,
      quantidadeDisponivel: disponivel,
    },
  });

  await syncPurchaseSuggestionAfterStockChange(tx, produtoId, disponivel);

  return { total, disponivel };
}

/** Sincroniza caches de todos os lotes do produto após entrada em massa. */
export async function syncAllLoteStockBalancesForProduct(
  tx: StockTx,
  produtoId: bigint,
): Promise<void> {
  if (!tx.lote?.findMany) return;

  const lotes = await tx.lote.findMany({
    where: { produtoId, deletedAt: null },
    select: { id: true, quantidadeQuarentena: true },
  });

  for (const lote of lotes) {
    await syncLoteStockBalanceCache(tx, lote);
  }
}

/** @deprecated Use syncStockBalanceCache */
export const syncProductStockFromLotes = syncStockBalanceCache;

/** Após movimento de saída registado — refresca cache. */
export async function applyStockSaleDelta(
  tx: StockTx,
  produtoId: bigint,
  _quantidade: number,
): Promise<void> {
  await syncStockBalanceCache(tx, produtoId);
}

/** Após movimento de entrada/devolução — refresca cache. */
export async function applyStockReturnDelta(
  tx: StockTx,
  produtoId: bigint,
  _quantidade: number,
): Promise<number> {
  const { total } = await syncStockBalanceCache(tx, produtoId);
  return total;
}

/** Após movimento de ajuste — refresca cache. */
export async function applyStockAdjustDelta(
  tx: StockTx,
  produtoId: bigint,
  _delta: number,
): Promise<number> {
  const { total } = await syncStockBalanceCache(tx, produtoId);
  return total;
}
