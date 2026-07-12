/**
 * Selecção FEFO de lotes e resolução de preços (fonte de verdade: Lote.precoVenda).
 * Quantidade disponível: derivada de EstoqueMovimento via lote-stock.service.
 */

import {
  getLoteQuantidadeDisponivel,
  type LoteStockTx,
} from "./lote-stock.service";
import { LOTE_COM_STOCK_DISPONIVEL_WHERE } from "./lote-stock-read.util";
import { startOfUtcDay } from "./expiry-date.util";
import type { FefoLoteRow } from "./lote.types";

export const FEFO_LOTE_FILTER = {
  ativo: true,
  deletedAt: null,
  estadoSanitario: "VALIDO" as const,
  disponibilidade: "DISPONIVEL" as const,
};

/** Lote candidato no PDV: FEFO + validade (sem exigir cache de stock). */
export function buildFefoLoteWhereForPosCandidates(now = new Date()) {
  return {
    ...FEFO_LOTE_FILTER,
    dataValidade: { gte: startOfUtcDay(now) },
  };
}

/** Lote elegível para venda no PDV: FEFO + validade + stock disponível (cache). */
export function buildFefoLoteWhereForPos(now = new Date()) {
  return {
    ...buildFefoLoteWhereForPosCandidates(now),
    ...LOTE_COM_STOCK_DISPONIVEL_WHERE,
  };
}

export type FefoLoteTx = LoteStockTx;

/** @deprecated Use readLoteDisponivel — mantido para compatibilidade em testes. */
export function loteQuantidadeDisponivel(lote: {
  stockBalance?: { quantidadeDisponivel?: unknown } | null;
  quantidadeAtual?: unknown;
}): number {
  if (lote.stockBalance != null) {
    return Math.max(0, Number(lote.stockBalance.quantidadeDisponivel ?? 0) || 0);
  }
  return Math.max(0, Number(lote.quantidadeAtual ?? 0) || 0);
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
  if (!tx.lote?.findFirst || !tx.lote?.findMany) {
    return null;
  }

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
        dataValidade: { gte: startOfUtcDay() },
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
      dataValidade: { gte: startOfUtcDay() },
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
