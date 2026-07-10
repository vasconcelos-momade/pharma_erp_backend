import {
  getLoteQuantidadeFromMovements,
  loteQuantidadeDisponivelFromTotal,
  signedMovementDelta,
} from "./lote-stock.service";
import { readLoteDisponivel, readLoteTotal } from "./lote-stock-read.util";

type LoteWithStock = {
  id: bigint;
  quantidadeQuarentena?: unknown;
  stockBalance?: {
    quantidadeTotal?: unknown;
    quantidadeDisponivel?: unknown;
    lastUpdated?: Date;
  } | null;
};

function patchDisponivelFromTotal(lote: LoteWithStock): void {
  const total = readLoteTotal(lote);
  const disponivel = readLoteDisponivel(lote);
  if (disponivel <= 0 && total > 0) {
    lote.stockBalance = {
      ...(lote.stockBalance ?? {}),
      quantidadeTotal: total,
      quantidadeDisponivel: loteQuantidadeDisponivelFromTotal(
        total,
        lote.quantidadeQuarentena,
      ),
    };
  }
}

/** Preenche stock a partir de EstoqueMovimento quando o cache LoteStockBalance está vazio. */
export async function enrichLotesStockFromMovements(
  tx: unknown,
  lotes: LoteWithStock[],
): Promise<void> {
  if (lotes.length === 0) {
    return;
  }

  for (const lote of lotes) {
    patchDisponivelFromTotal(lote);
  }

  const needsMovementLookup = lotes.filter(
    (lote) => readLoteTotal(lote) <= 0 && readLoteDisponivel(lote) <= 0,
  );
  if (needsMovementLookup.length === 0) {
    return;
  }

  const prisma = tx as {
    estoqueMovimento?: {
      findMany: (args: unknown) => Promise<
        Array<{
          loteId: bigint;
          tipo: string;
          quantidade: unknown;
          estoqueAnterior?: unknown;
          estoqueFinal?: unknown;
        }>
      >;
    };
  };

  if (!prisma.estoqueMovimento?.findMany) {
    for (const lote of needsMovementLookup) {
      const total = await getLoteQuantidadeFromMovements(tx as never, lote.id);
      if (total <= 0) {
        continue;
      }
      lote.stockBalance = {
        quantidadeTotal: total,
        quantidadeDisponivel: loteQuantidadeDisponivelFromTotal(
          total,
          lote.quantidadeQuarentena,
        ),
      };
    }
    return;
  }

  const ids = needsMovementLookup.map((lote) => lote.id);
  const movements = await prisma.estoqueMovimento.findMany({
    where: { loteId: { in: ids }, deletedAt: null },
    select: {
      loteId: true,
      tipo: true,
      quantidade: true,
      estoqueAnterior: true,
      estoqueFinal: true,
    },
  });

  const totalsByLote = new Map<string, number>();
  for (const movement of movements) {
    const key = movement.loteId.toString();
    totalsByLote.set(
      key,
      (totalsByLote.get(key) ?? 0) + signedMovementDelta(movement),
    );
  }

  for (const lote of needsMovementLookup) {
    const total = Math.max(0, totalsByLote.get(lote.id.toString()) ?? 0);
    if (total <= 0) {
      continue;
    }
    lote.stockBalance = {
      quantidadeTotal: total,
      quantidadeDisponivel: loteQuantidadeDisponivelFromTotal(
        total,
        lote.quantidadeQuarentena,
      ),
    };
  }
}
