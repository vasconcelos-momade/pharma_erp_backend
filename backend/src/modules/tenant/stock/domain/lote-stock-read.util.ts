/** Filtros Prisma para lotes com stock disponível (cache LoteStockBalance). */
export const LOTE_COM_STOCK_DISPONIVEL_WHERE = {
  stockBalance: { quantidadeDisponivel: { gt: 0 } },
} as const;

export const LOTE_COM_STOCK_TOTAL_WHERE = {
  stockBalance: { quantidadeTotal: { gt: 0 } },
} as const;

export function readLoteDisponivel(lote: {
  stockBalance?: { quantidadeDisponivel?: unknown } | null;
  quantidadeAtual?: unknown;
  quantidadeQuarentena?: unknown;
}): number {
  if (lote.stockBalance?.quantidadeDisponivel != null) {
    return Math.max(0, Number(lote.stockBalance.quantidadeDisponivel) || 0);
  }
  return Math.max(
    0,
    Number(lote.quantidadeAtual ?? 0) - Number(lote.quantidadeQuarentena ?? 0),
  );
}

export function readLoteTotal(lote: {
  stockBalance?: { quantidadeTotal?: unknown } | null;
  quantidadeAtual?: unknown;
}): number {
  if (lote.stockBalance?.quantidadeTotal != null) {
    return Math.max(0, Number(lote.stockBalance.quantidadeTotal) || 0);
  }
  return Math.max(0, Number(lote.quantidadeAtual ?? 0));
}
