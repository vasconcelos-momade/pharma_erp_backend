/** Filtros Prisma para lotes com stock disponível (cache LoteStockBalance). */
export const LOTE_COM_STOCK_DISPONIVEL_WHERE = {
  stockBalance: { quantidadeDisponivel: { gt: 0 } },
} as const;

export const LOTE_COM_STOCK_TOTAL_WHERE = {
  stockBalance: { quantidadeTotal: { gt: 0 } },
} as const;

export function readLoteDisponivel(lote: {
  stockBalance?: { quantidadeDisponivel?: unknown } | null;
}): number {
  return Math.max(0, Number(lote.stockBalance?.quantidadeDisponivel ?? 0) || 0);
}

export function readLoteTotal(lote: {
  stockBalance?: { quantidadeTotal?: unknown } | null;
}): number {
  return Math.max(0, Number(lote.stockBalance?.quantidadeTotal ?? 0) || 0);
}
