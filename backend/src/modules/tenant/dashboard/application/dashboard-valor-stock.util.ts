/**
 * Valor do stock (dashboard / Stocks e lotes):
 * VALOR STOCK = Σ (estoque atual do lote × preço de venda do lote)
 *
 * - Preço de venda: tabela Lotes
 * - Estoque atual: soma de deltas em EstoqueMovimento (fonte de verdade)
 * - Apenas lotes válidos, não expirados e com saldo disponível > 0
 */
import { enrichLotesStockFromMovements } from "../../stock/domain/enrich-lote-stock.util";
import { buildFefoLoteWhereForPosCandidates } from "../../stock/domain/fefo-lote.service";
import { readLoteDisponivel } from "../../stock/domain/lote-stock-read.util";
import { round2, toNumber } from "./dashboard-date.util";

export type ValorStockLoteRow = {
  id: bigint;
  precoVenda?: unknown;
  quantidadeQuarentena?: unknown;
  stockBalance?: {
    quantidadeDisponivel?: unknown;
    quantidadeTotal?: unknown;
  } | null;
  produto?: {
    categoria?: { nome?: string | null } | null;
  } | null;
};

/** Lotes candidatos FEFO (válidos, não expirados); stock filtrado após movimentos. */
export function valorStockLoteWhere(now = new Date()) {
  return buildFefoLoteWhereForPosCandidates(now);
}

export const valorStockLoteSelect = {
  id: true,
  precoVenda: true,
  quantidadeQuarentena: true,
} as const;

export async function loadValorStockLotesFromMovements(
  prisma: unknown,
  now = new Date(),
  options?: { includeCategoria?: boolean },
): Promise<ValorStockLoteRow[]> {
  const select: Record<string, unknown> = {
    ...valorStockLoteSelect,
  };
  if (options?.includeCategoria) {
    select.produto = { select: { categoria: { select: { nome: true } } } };
  }

  const lotes = await (prisma as { lote: { findMany: (args: unknown) => Promise<ValorStockLoteRow[]> } }).lote.findMany({
    where: valorStockLoteWhere(now),
    select,
  });

  await enrichLotesStockFromMovements(prisma, lotes);

  return lotes.filter((lote) => readLoteDisponivel(lote) > 0);
}

export function sumValorStockFromLotes(rows: ValorStockLoteRow[]): number {
  return round2(
    rows.reduce((sum, row) => {
      const qty = readLoteDisponivel(row);
      if (qty <= 0) return sum;
      const preco = toNumber(row.precoVenda);
      if (preco <= 0) return sum;
      return sum + qty * preco;
    }, 0),
  );
}

export function groupValorStockPorCategoria(
  rows: ValorStockLoteRow[],
): Array<{ categoria: string; valor: number }> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const qty = readLoteDisponivel(row);
    if (qty <= 0) continue;
    const preco = toNumber(row.precoVenda);
    if (preco <= 0) continue;
    const categoria = row.produto?.categoria?.nome ?? "Sem categoria";
    map.set(categoria, (map.get(categoria) ?? 0) + qty * preco);
  }
  return [...map.entries()].map(([categoria, valor]) => ({
    categoria,
    valor: round2(valor),
  }));
}
