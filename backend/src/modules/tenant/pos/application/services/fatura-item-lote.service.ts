export type FaturaItemLoteWrite = {
  loteId: bigint;
  quantidade: number;
  custoUnitario: number;
  ordemFefo: number;
};

/** Persiste o detalhe FEFO (multi-lote) de uma linha de fatura. */
export async function persistFaturaItemLotes(
  tx: any,
  faturaItemId: bigint,
  lotes: FaturaItemLoteWrite[],
): Promise<void> {
  if (!lotes.length) {
    return;
  }

  await tx.faturaItemLote.createMany({
    data: lotes.map((entry) => ({
      faturaItemId: faturaItemId,
      loteId: entry.loteId,
      quantidade: entry.quantidade,
      custoUnitario: entry.custoUnitario,
      ordemFefo: entry.ordemFefo,
    })),
  });
}

export type FaturaItemLoteRow = {
  loteId: bigint;
  quantidade: unknown;
};

/** Reverte stock por lote a partir de `fatura_item_lotes` (fallback: loteId da linha). */
export async function revertFaturaItemLoteStock(params: {
  tx: any;
  faturaItemId: bigint;
  fallbackLoteId: bigint | null;
  fallbackQuantidade: number;
}): Promise<Array<{ loteId: bigint; quantidade: number }>> {
  const rows: FaturaItemLoteRow[] = await params.tx.faturaItemLote.findMany({
    where: { faturaItemId: params.faturaItemId },
    orderBy: { ordemFefo: "asc" },
    select: { loteId: true, quantidade: true },
  });

  if (rows.length > 0) {
    return rows.map((row) => ({
      loteId: row.loteId,
      quantidade: Number(row.quantidade),
    }));
  }

  if (params.fallbackLoteId) {
    return [{ loteId: params.fallbackLoteId, quantidade: params.fallbackQuantidade }];
  }

  return [];
}
