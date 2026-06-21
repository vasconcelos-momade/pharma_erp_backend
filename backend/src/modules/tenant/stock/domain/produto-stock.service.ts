/**
 * Stock operacional: EstoqueMovimento é a fonte de verdade;
 * StockBalance é projeção de leitura (total, reservado, disponível).
 */

export type StockTx = {
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
  };
  lote?: {
    findMany: (args: {
      where: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => Promise<Array<{ quantidadeAtual: unknown }>>;
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

export async function getQuantidadeTotal(
  tx: StockTx,
  produtoId: bigint,
): Promise<number> {
  const balance = await tx.stockBalance.findUnique({
    where: { produtoId },
  });
  if (balance) {
    return toNumber(balance.quantidadeTotal);
  }

  return getQuantidadeTotalFromMovements(tx, produtoId);
}

export async function getQuantidadeDisponivel(
  tx: StockTx,
  produtoId: bigint,
): Promise<number> {
  const balance = await tx.stockBalance.findUnique({
    where: { produtoId },
  });
  if (balance) {
    return toNumber(balance.quantidadeDisponivel);
  }

  return getQuantidadeTotalFromMovements(tx, produtoId);
}

/** Baixa física na venda (total e disponível). */
export async function applyStockSaleDelta(
  tx: StockTx,
  produtoId: bigint,
  quantidade: number,
): Promise<void> {
  const totalBefore = await getQuantidadeTotal(tx, produtoId);
  const totalAfter = Math.max(0, totalBefore - quantidade);

  await tx.stockBalance.upsert({
    where: { produtoId },
    create: {
      produtoId,
      quantidadeTotal: totalAfter,
      quantidadeReservada: 0,
      quantidadeDisponivel: totalAfter,
    },
    update: {
      quantidadeTotal: { decrement: quantidade },
      quantidadeDisponivel: { decrement: quantidade },
    },
  });
}

/** Ajuste de inventário (+/-). */
export async function applyStockAdjustDelta(
  tx: StockTx,
  produtoId: bigint,
  delta: number,
): Promise<number> {
  if (delta >= 0) {
    await applyStockReturnDelta(tx, produtoId, delta);
    return getQuantidadeTotal(tx, produtoId);
  }
  await applyStockSaleDelta(tx, produtoId, Math.abs(delta));
  return getQuantidadeTotal(tx, produtoId);
}

/** Repõe stock na anulação de venda. */
export async function applyStockReturnDelta(
  tx: StockTx,
  produtoId: bigint,
  quantidade: number,
): Promise<number> {
  const totalBefore = await getQuantidadeTotal(tx, produtoId);
  const totalAfter = totalBefore + quantidade;

  await tx.stockBalance.upsert({
    where: { produtoId },
    create: {
      produtoId,
      quantidadeTotal: totalAfter,
      quantidadeReservada: 0,
      quantidadeDisponivel: totalAfter,
    },
    update: {
      quantidadeTotal: { increment: quantidade },
      quantidadeDisponivel: { increment: quantidade },
    },
  });

  return totalAfter;
}

/** Sincroniza StockBalance a partir da soma dos lotes activos. */
export async function syncProductStockFromLotes(
  tx: StockTx & {
    lote: {
      findMany: (args: {
        where: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) => Promise<Array<{ quantidadeAtual: unknown }>>;
    };
  },
  produtoId: bigint,
): Promise<number> {
  const lotes = await tx.lote.findMany({
    where: {
      produtoId,
      deletedAt: null,
      ativo: true,
    },
    select: { quantidadeAtual: true },
  });

  const total = lotes.reduce(
    (sum, lote) => sum + toNumber(lote.quantidadeAtual),
    0,
  );

  const balance = await tx.stockBalance.findUnique({
    where: { produtoId },
  });
  const reservada = toNumber(balance?.quantidadeReservada);
  const disponivel = Math.max(0, total - reservada);

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

  return total;
}
