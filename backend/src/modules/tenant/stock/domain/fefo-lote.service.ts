/**
 * Selecção FEFO de lotes e resolução de preços (fonte de verdade: Lote.precoVenda).
 * Quantidade disponível: derivada de EstoqueMovimento via lote-stock.service.
 */

import {
  getLoteQuantidadeDisponivel,
  loteQuantidadeDisponivelFromTotal,
  type LoteStockTx,
} from "./lote-stock.service";

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
  quantidadeQuarentena?: unknown;
  precoCompra: unknown;
  precoVenda?: unknown | null;
};

export type FefoLoteTx = LoteStockTx;

/** @deprecated Use getLoteQuantidadeDisponivel — mantido para compatibilidade em testes. */
export function loteQuantidadeDisponivel(lote: {
  quantidadeAtual?: unknown;
  quantidadeQuarentena?: unknown;
  stockBalance?: { quantidadeDisponivel?: unknown } | null;
}): number {
  if (lote.stockBalance?.quantidadeDisponivel != null) {
    return Math.max(0, Number(lote.stockBalance.quantidadeDisponivel) || 0);
  }
  return loteQuantidadeDisponivelFromTotal(
    Number(lote.quantidadeAtual ?? 0),
    lote.quantidadeQuarentena,
  );
}

export function resolveLotePrecoVenda(
  lote: { precoVenda?: unknown | null; numeroLote?: string },
  produtoNomeComercial?: string,
): number {
  const preco = Number(lote.precoVenda ?? 0);
  if (!Number.isFinite(preco) || preco <= 0) {
    const ref = produtoNomeComercial?.trim() || lote.numeroLote || "lote";
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
  const select = {
    id: true,
    numeroLote: true,
    dataValidade: true,
    quantidadeQuarentena: true,
    precoCompra: true,
    precoVenda: true,
  };

  if (loteId) {
    const lote = await tx.lote.findFirst({
      where: {
        id: loteId,
        produtoId,
        ...FEFO_LOTE_FILTER,
        dataValidade: { gt: new Date() },
      },
      select,
    });
    if (!lote) return null;
    const disponivel = await getLoteQuantidadeDisponivel(tx, lote);
    return disponivel > 0 ? lote : null;
  }

  const lotes = await tx.lote.findMany({
    where: {
      produtoId,
      ...FEFO_LOTE_FILTER,
      dataValidade: { gt: new Date() },
    },
    orderBy: [{ dataValidade: "asc" }, { createdAt: "asc" }],
    select,
  });

  for (const lote of lotes) {
    const disponivel = await getLoteQuantidadeDisponivel(tx, lote);
    if (disponivel > 0) return lote;
  }

  return null;
}

export async function selectFefoLoteForSale(
  tx: FefoLoteTx,
  produtoId: bigint,
  loteId?: bigint | null,
  produtoNomeComercial?: string,
): Promise<{ lote: FefoLoteRow; precoVenda: number }> {
  const lote = await findFefoLote(tx, produtoId, loteId);
  if (!lote) {
    const nome = produtoNomeComercial?.trim() || `produto ${produtoId}`;
    throw new Error(
      `Sem lotes disponíveis (FEFO) com stock para «${nome}».`,
    );
  }

  const disponivel = await getLoteQuantidadeDisponivel(tx, lote);
  if (disponivel <= 0) {
    throw new Error(
      `Stock insuficiente no lote ${lote.numeroLote} para «${produtoNomeComercial ?? produtoId}».`,
    );
  }

  return {
    lote,
    precoVenda: resolveLotePrecoVenda(lote, produtoNomeComercial),
  };
}
