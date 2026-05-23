/**
 * Stock operacional: StockBalance é a fonte de leitura; estoqueAtual é cache reconciliado.
 */

export type StockTx = {
  produto: {
    findUnique: (args: {
      where: { id: bigint };
      select?: { estoqueAtual?: boolean; nome?: boolean };
    }) => Promise<{ estoqueAtual?: unknown; nome?: string } | null>;
    update: (args: {
      where: { id: bigint };
      data: { estoqueAtual: number | { increment?: number; decrement?: number } };
    }) => Promise<unknown>;
  };
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
};

export async function getQuantidadeDisponivel(
  tx: StockTx,
  produtoId: bigint,
): Promise<number> {
  const balance = await tx.stockBalance.findUnique({
    where: { produtoId },
  });
  if (balance) {
    return Number(balance.quantidadeDisponivel);
  }

  const produto = await tx.produto.findUnique({
    where: { id: produtoId },
    select: { estoqueAtual: true },
  });
  return Number(produto?.estoqueAtual ?? 0);
}

export async function getQuantidadeTotal(
  tx: StockTx,
  produtoId: bigint,
): Promise<number> {
  const balance = await tx.stockBalance.findUnique({
    where: { produtoId },
  });
  if (balance) {
    return Number(balance.quantidadeTotal);
  }

  const produto = await tx.produto.findUnique({
    where: { id: produtoId },
    select: { estoqueAtual: true },
  });
  return Number(produto?.estoqueAtual ?? 0);
}

/** Atualiza cache `produtos.estoqueAtual` a partir do total físico. */
export async function reconcileEstoqueAtualCache(
  tx: StockTx,
  produtoId: bigint,
  quantidadeTotal: number,
): Promise<void> {
  await tx.produto.update({
    where: { id: produtoId },
    data: { estoqueAtual: quantidadeTotal },
  });
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

  await reconcileEstoqueAtualCache(tx, produtoId, totalAfter);
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

  await reconcileEstoqueAtualCache(tx, produtoId, totalAfter);
  return totalAfter;
}
