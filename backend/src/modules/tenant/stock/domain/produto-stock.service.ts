/**
 * Stock operacional: EstoqueMovimento é a fonte de verdade;
 * StockBalance / LoteStockBalance são projeções/cache de leitura.
 */

import type { FefoLoteTx } from "./fefo-lote.service";
import {
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

/** Total físico a partir do último movimento registado (fonte de verdade). */
export async function getQuantidadeTotalFromMovements(
  tx: StockTx,
  produtoId: bigint,
): Promise<number> {
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

export async function getQuantidadeDisponivel(
  tx: StockTx,
  produtoId: bigint,
): Promise<number> {
  const balance = await tx.stockBalance.findUnique({
    where: { produtoId },
  });
  const cachedDisponivel = toNumber(balance?.quantidadeDisponivel);
  if (cachedDisponivel > 0) {
    return cachedDisponivel;
  }

  // Quando o cache do produto está zerado, reidrata a partir dos movimentos/lotes
  // para evitar bloquear o PDV com stock falso igual a zero.
  const reservada = toNumber(balance?.quantidadeReservada);
  const total = await getQuantidadeTotal(tx, produtoId);
  const sellable = await getSellableQuantityFromLotes(tx, produtoId);
  const disponivel = Math.max(0, Math.min(total, sellable) - reservada);

  if (
    balance == null ||
    cachedDisponivel !== disponivel ||
    toNumber(balance.quantidadeTotal) !== total
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
        quantidadeDisponivel: disponivel,
      },
    });
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
  const balance = await tx.stockBalance.findUnique({
    where: { produtoId },
  });
  const reservada = toNumber(balance?.quantidadeReservada);
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
      quantidadeDisponivel: disponivel,
    },
  });

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
