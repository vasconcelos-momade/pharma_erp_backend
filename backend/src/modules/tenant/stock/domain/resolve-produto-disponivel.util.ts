import { toNumber } from "../../dashboard/application/dashboard-date.util";
import { enrichLotesStockFromMovements } from "./enrich-lote-stock.util";
import { readLoteDisponivel } from "./lote-stock-read.util";

type ProdutoStockRow = {
  id: bigint;
  stockBalance?: { quantidadeDisponivel?: unknown } | null;
};

/** Resolve stock disponível: cache do produto, lotes activos e último movimento. */
export async function buildProdutoDisponivelMap(
  prisma: unknown,
  produtos: ProdutoStockRow[],
): Promise<Map<string, number>> {
  const db = prisma as {
    estoqueMovimento: {
      findMany: (args: unknown) => Promise<
        Array<{ produtoId: bigint; estoqueFinal?: unknown }>
      >;
    };
    lote: {
      findMany: (args: unknown) => Promise<
        Array<{
          produtoId: bigint;
          quantidadeQuarentena?: unknown;
          stockBalance?: {
            quantidadeDisponivel?: unknown;
            quantidadeTotal?: unknown;
          } | null;
        }>
      >;
    };
  };

  const result = new Map<string, number>();
  const needsFallback: bigint[] = [];

  for (const produto of produtos) {
    const cache = toNumber(produto.stockBalance?.quantidadeDisponivel);
    const key = produto.id.toString();
    if (cache > 0) {
      result.set(key, cache);
      continue;
    }
    needsFallback.push(produto.id);
  }

  if (needsFallback.length === 0) {
    return result;
  }

  const [movements, lotes] = await Promise.all([
    db.estoqueMovimento.findMany({
      where: { produtoId: { in: needsFallback }, deletedAt: null },
      select: { produtoId: true, estoqueFinal: true, createdAt: true, id: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    db.lote.findMany({
      where: { produtoId: { in: needsFallback }, deletedAt: null, ativo: true },
      select: {
        id: true,
        produtoId: true,
        quantidadeQuarentena: true,
        stockBalance: {
          select: { quantidadeDisponivel: true, quantidadeTotal: true },
        },
      },
    }),
  ]);

  await enrichLotesStockFromMovements(db, lotes);

  const movementByProduto = new Map<string, number>();
  for (const movement of movements) {
    const key = movement.produtoId.toString();
    if (!movementByProduto.has(key)) {
      movementByProduto.set(key, toNumber(movement.estoqueFinal));
    }
  }

  const lotesSumByProduto = new Map<string, number>();
  for (const lote of lotes) {
    const key = lote.produtoId.toString();
    const disponivel = readLoteDisponivel(lote);
    lotesSumByProduto.set(key, (lotesSumByProduto.get(key) ?? 0) + disponivel);
  }

  for (const produtoId of needsFallback) {
    const key = produtoId.toString();
    const fromMovement = movementByProduto.get(key) ?? 0;
    const fromLotes = lotesSumByProduto.get(key) ?? 0;
    result.set(key, Math.max(fromMovement, fromLotes, 0));
  }

  return result;
}
