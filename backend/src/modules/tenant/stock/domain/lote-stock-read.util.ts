/** Filtros Prisma para lotes com stock disponível (cache LoteStockBalance). */
export const LOTE_COM_STOCK_DISPONIVEL_WHERE = {
  stockBalance: { quantidadeDisponivel: { gt: 0 } },
};

export const LOTE_COM_STOCK_TOTAL_WHERE = {
  stockBalance: { quantidadeTotal: { gt: 0 } },
};

export function readLoteDisponivel(lote: {
  stockBalance?: { quantidadeDisponivel?: unknown; quantidadeTotal?: unknown } | null;
  quantidadeQuarentena?: unknown;
  quantidadeAtual?: unknown;
}): number {
  const quarentena = Math.max(0, Number(lote.quantidadeQuarentena ?? 0) || 0);

  if (lote.stockBalance != null) {
    const disponivel = Number(lote.stockBalance.quantidadeDisponivel ?? 0) || 0;
    if (disponivel > 0) {
      return Math.max(0, disponivel);
    }
    const total = Number(lote.stockBalance.quantidadeTotal ?? 0) || 0;
    if (total > 0) {
      return Math.max(0, total - quarentena);
    }
    return 0;
  }

  return Math.max(0, Number(lote.quantidadeAtual ?? 0) || 0);
}

export function readLoteTotal(lote: {
  stockBalance?: { quantidadeTotal?: unknown; quantidadeDisponivel?: unknown } | null;
  quantidadeAtual?: unknown;
}): number {
  if (lote.stockBalance != null) {
    const total = Number(lote.stockBalance.quantidadeTotal ?? 0) || 0;
    if (total > 0) {
      return total;
    }
    const disponivel = Number(lote.stockBalance.quantidadeDisponivel ?? 0) || 0;
    if (disponivel > 0) {
      return disponivel;
    }
    return 0;
  }

  return Math.max(0, Number(lote.quantidadeAtual ?? 0) || 0);
}
