/**
 * Rastreabilidade de lotes por item de fatura — única fonte de verdade.
 */

export type FaturaItemLoteTx = {
  faturaItemLote: {
    findFirst: (args: {
      where: Record<string, unknown>;
      orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
      select?: Record<string, boolean>;
      include?: Record<string, unknown>;
    }) => Promise<{
      loteId?: bigint;
      quantidade?: unknown;
      ordemFefo?: number;
      lote?: { id: bigint; numeroLote?: string; quantidadeQuarentena?: unknown };
    } | null>;
    findMany: (args: {
      where: Record<string, unknown>;
      orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
      select?: Record<string, boolean>;
      include?: Record<string, unknown>;
    }) => Promise<
      Array<{
        loteId: bigint;
        quantidade: unknown;
        ordemFefo: number;
        lote?: { id: bigint; numeroLote?: string; quantidadeQuarentena?: unknown };
      }>
    >;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    createMany: (args: { data: Record<string, unknown>[] }) => Promise<unknown>;
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<unknown>;
    deleteMany: (args: { where: Record<string, unknown> }) => Promise<unknown>;
    upsert: (args: {
      where: Record<string, unknown>;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<unknown>;
  };
};

export async function getPrimaryLoteIdForItem(
  tx: FaturaItemLoteTx,
  faturaItemId: bigint,
): Promise<bigint | null> {
  const row = await tx.faturaItemLote.findFirst({
    where: { faturaItemId },
    orderBy: { ordemFefo: "asc" },
    select: { loteId: true },
  });
  return row?.loteId ?? null;
}

export async function getLoteAllocationsForItem(
  tx: FaturaItemLoteTx,
  faturaItemId: bigint,
) {
  return tx.faturaItemLote.findMany({
    where: { faturaItemId },
    orderBy: { ordemFefo: "asc" },
    include: {
      lote: { select: { id: true, numeroLote: true, quantidadeQuarentena: true } },
    },
  });
}

/** Carrinho rascunho: uma alocação provisória FEFO por linha de produto. */
export async function setDraftItemLoteAllocation(
  tx: FaturaItemLoteTx,
  faturaItemId: bigint,
  loteId: bigint,
  quantidade: number,
): Promise<void> {
  await tx.faturaItemLote.deleteMany({ where: { faturaItemId } });
  if (quantidade > 0) {
    await tx.faturaItemLote.create({
      data: {
        faturaItemId,
        loteId,
        quantidade,
        ordemFefo: 1,
      },
    });
  }
}

export async function syncDraftItemLoteQuantity(
  tx: FaturaItemLoteTx,
  faturaItemId: bigint,
  quantidade: number,
): Promise<void> {
  await tx.faturaItemLote.updateMany({
    where: { faturaItemId },
    data: { quantidade },
  });
}

export type LoteAllocationInput = {
  loteId: bigint;
  quantidade: number;
};

/** Persiste N alocações FEFO para um item emitido. */
export async function replaceItemLoteAllocations(
  tx: FaturaItemLoteTx,
  faturaItemId: bigint,
  allocations: LoteAllocationInput[],
): Promise<void> {
  await tx.faturaItemLote.deleteMany({ where: { faturaItemId } });
  if (allocations.length === 0) return;

  await tx.faturaItemLote.createMany({
    data: allocations.map((alloc, index) => ({
      faturaItemId,
      loteId: alloc.loteId,
      quantidade: alloc.quantidade,
      ordemFefo: index + 1,
    })),
  });
}

/** Formato API para Flutter (lotes[] no detalhe da fatura). */
export function mapAllocationsToApiLotes(
  allocations: Array<{
    loteId: bigint;
    quantidade: unknown;
    ordemFefo: number;
    lote?: { numeroLote?: string } | null;
  }>,
) {
  return allocations.map((alloc) => ({
    loteId: alloc.loteId,
    codigo: alloc.lote?.numeroLote ?? "",
    quantidade: alloc.quantidade,
    ordemFefo: alloc.ordemFefo,
  }));
}
