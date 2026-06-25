/**
 * Selecção FEFO de lotes e resolução de preços (fonte de verdade: Lote.precoVenda).
 */

export const FEFO_LOTE_FILTER = {
  ativo: true,
  deletedAt: null,
  estadoSanitario: "VALIDO" as const,
  disponibilidade: "DISPONIVEL" as const,
};

export type FefoLoteRow = {
  id: bigint;
  numeroLote: string;
  dataValidade: Date;
  quantidadeAtual: unknown;
  quantidadeQuarentena?: unknown;
  precoCompra: unknown;
  precoVenda?: unknown | null;
};

export type FefoLoteTx = {
  lote: {
    findFirst: (args: {
      where: Record<string, unknown>;
      orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
      select?: Record<string, boolean>;
    }) => Promise<FefoLoteRow | null>;
    findMany: (args: {
      where: Record<string, unknown>;
      orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
      select?: Record<string, boolean>;
    }) => Promise<FefoLoteRow[]>;
  };
};

export function loteQuantidadeDisponivel(lote: {
  quantidadeAtual: unknown;
  quantidadeQuarentena?: unknown;
}): number {
  return Math.max(
    0,
    Number(lote.quantidadeAtual) - Number(lote.quantidadeQuarentena ?? 0),
  );
}

export function resolveLotePrecoVenda(
  lote: { precoVenda?: unknown | null; numeroLote?: string },
  produtoNome?: string,
): number {
  const preco = Number(lote.precoVenda ?? 0);
  if (!Number.isFinite(preco) || preco <= 0) {
    const ref = produtoNome?.trim() || lote.numeroLote || "lote";
    throw new Error(
      `O lote «${ref}» não tem preço de venda configurado. Defina precoVenda no lote.`,
    );
  }
  return preco;
}

export async function findFefoLote(
  tx: FefoLoteTx,
  produtoId: bigint,
  loteId?: bigint | null,
): Promise<FefoLoteRow | null> {
  if (loteId) {
    return tx.lote.findFirst({
      where: {
        id: loteId,
        produtoId,
        ...FEFO_LOTE_FILTER,
        dataValidade: { gt: new Date() },
      },
      select: {
        id: true,
        numeroLote: true,
        dataValidade: true,
        quantidadeAtual: true,
        quantidadeQuarentena: true,
        precoCompra: true,
        precoVenda: true,
      },
    });
  }

  const lotes = await tx.lote.findMany({
    where: {
      produtoId,
      ...FEFO_LOTE_FILTER,
      dataValidade: { gt: new Date() },
    },
    orderBy: { dataValidade: "asc" },
    select: {
      id: true,
      numeroLote: true,
      dataValidade: true,
      quantidadeAtual: true,
      quantidadeQuarentena: true,
      precoCompra: true,
      precoVenda: true,
    },
  });

  return (
    lotes.find((lote) => loteQuantidadeDisponivel(lote) > 0) ?? null
  );
}

export async function selectFefoLoteForSale(
  tx: FefoLoteTx,
  produtoId: bigint,
  loteId?: bigint | null,
  produtoNome?: string,
): Promise<{ lote: FefoLoteRow; precoVenda: number }> {
  const lote = await findFefoLote(tx, produtoId, loteId);
  if (!lote) {
    const nome = produtoNome?.trim() || `produto ${produtoId}`;
    throw new Error(
      `Sem lotes disponíveis (FEFO) com stock para «${nome}».`,
    );
  }
  if (loteQuantidadeDisponivel(lote) <= 0) {
    throw new Error(
      `Stock insuficiente no lote ${lote.numeroLote} para «${produtoNome ?? produtoId}».`,
    );
  }
  return {
    lote,
    precoVenda: resolveLotePrecoVenda(lote, produtoNome),
  };
}
