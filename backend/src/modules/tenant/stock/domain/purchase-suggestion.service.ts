import { round2, toNumber } from "../../dashboard/application/dashboard-date.util";
import { resolvePrincipalSupplierId } from "./purchase-supplier.util";

export const DEFAULT_COVERAGE_DAYS = 30;
export const CONSUMPTION_PERIOD_DAYS = 30;

type PurchaseSuggestionTx = {
  produto?: {
    findUnique: (args: {
      where: { id: bigint };
      select?: Record<string, boolean | object>;
    }) => Promise<{
      id: bigint;
      estoqueMinimo: unknown;
      ativo: boolean;
      deletedAt: Date | null;
      stockBalance?: { quantidadeDisponivel: unknown } | null;
      fornecedores?: Array<{
        fornecedorPrincipal: boolean;
        fornecedorId: bigint;
      }>;
    } | null>;
  };
  purchaseSuggestion?: {
    findUnique: (args: {
      where: { produtoId: bigint };
    }) => Promise<{
      id: bigint;
      origem: "AUTOMATICA" | "MANUAL";
      quantidadeSugerida: unknown;
    } | null>;
    upsert: (args: {
      where: { produtoId: bigint };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<unknown>;
    delete: (args: { where: { produtoId: bigint } }) => Promise<unknown>;
    deleteMany: (args: { where: Record<string, unknown> }) => Promise<unknown>;
  };
  estoqueMovimento?: {
    findFirst?: (args: {
      where: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => Promise<{ id: bigint } | null>;
    findMany: (args: {
      where: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => Promise<Array<{ quantidade: unknown }>>;
  };
};

async function hasStockMovementHistory(
  tx: PurchaseSuggestionTx,
  produtoId: bigint,
): Promise<boolean> {
  if (!tx.estoqueMovimento?.findFirst) {
    return false;
  }

  const movement = await tx.estoqueMovimento.findFirst({
    where: { produtoId, deletedAt: null },
    select: { id: true },
  });

  return movement != null;
}

async function calculateDailyConsumption(
  tx: PurchaseSuggestionTx,
  produtoId: bigint,
): Promise<number> {
  if (!tx.estoqueMovimento?.findMany) {
    return 0;
  }

  const since = new Date();
  since.setDate(since.getDate() - CONSUMPTION_PERIOD_DAYS);

  const movements = await tx.estoqueMovimento.findMany({
    where: {
      produtoId,
      deletedAt: null,
      tipo: "SAIDA",
      createdAt: { gte: since },
    },
    select: { quantidade: true },
  });

  const totalSaidas = movements.reduce(
    (sum, row) => sum + Math.abs(toNumber(row.quantidade)),
    0,
  );

  return totalSaidas / CONSUMPTION_PERIOD_DAYS;
}

function resolveEstoqueAtual(
  produto: { stockBalance?: { quantidadeDisponivel: unknown } | null },
  disponivelFromSync?: number,
): number {
  if (disponivelFromSync != null) {
    return round2(disponivelFromSync);
  }
  return round2(toNumber(produto.stockBalance?.quantidadeDisponivel));
}

/**
 * Recalcula ou remove a sugestão automática após alteração de stock.
 * Itens manuais não são removidos automaticamente quando o stock sobe.
 */
export async function syncPurchaseSuggestionAfterStockChange(
  tx: PurchaseSuggestionTx,
  produtoId: bigint,
  disponivelFromSync?: number,
): Promise<void> {
  const db = tx as PurchaseSuggestionTx & {
    purchaseSuggestion?: PurchaseSuggestionTx["purchaseSuggestion"];
    produto?: PurchaseSuggestionTx["produto"];
    estoqueMovimento?: PurchaseSuggestionTx["estoqueMovimento"];
  };

  if (!db.purchaseSuggestion?.upsert || !db.produto?.findUnique) {
    return;
  }

  const produto = await db.produto.findUnique({
    where: { id: produtoId },
    select: {
      id: true,
      estoqueMinimo: true,
      ativo: true,
      deletedAt: true,
      stockBalance: { select: { quantidadeDisponivel: true } },
      fornecedores: {
        select: { fornecedorPrincipal: true, fornecedorId: true },
      },
    },
  });

  if (!produto || !produto.ativo || produto.deletedAt) {
    await db.purchaseSuggestion.deleteMany({ where: { produtoId } });
    return;
  }

  const supplierId = resolvePrincipalSupplierId(produto.fornecedores);

  const estoqueAtual = resolveEstoqueAtual(produto, disponivelFromSync);
  const estoqueMinimo = round2(toNumber(produto.estoqueMinimo));
  const existing = await db.purchaseSuggestion.findUnique({ where: { produtoId } });

  if (estoqueMinimo <= 0) {
    if (existing?.origem !== "MANUAL") {
      if (existing) {
        await db.purchaseSuggestion.delete({ where: { produtoId } });
      }
      return;
    }
  }

  const temHistoricoMovimentacao = await hasStockMovementHistory(db, produtoId);

  if (estoqueAtual > estoqueMinimo) {
    if (existing?.origem === "MANUAL") {
      await db.purchaseSuggestion.upsert({
        where: { produtoId },
        create: {
          produtoId,
          supplierId,
          quantidadeAtual: estoqueAtual,
          estoqueMinimo,
          consumoMedioDiario: 0,
          quantidadeSugerida: toNumber(existing.quantidadeSugerida),
          coberturaDias: DEFAULT_COVERAGE_DAYS,
          origem: "MANUAL",
        },
        update: {
          supplierId,
          quantidadeAtual: estoqueAtual,
          estoqueMinimo,
        },
      });
      return;
    }

    if (existing) {
      await db.purchaseSuggestion.delete({ where: { produtoId } });
    }
    return;
  }

  const consumoMedioDiario = round2(await calculateDailyConsumption(db, produtoId));
  const quantidadeSugeridaAutomatica = Math.max(
    0,
    consumoMedioDiario * DEFAULT_COVERAGE_DAYS + estoqueMinimo - estoqueAtual,
  );

  if (existing?.origem === "MANUAL") {
    await db.purchaseSuggestion.upsert({
      where: { produtoId },
      create: {
        produtoId,
        supplierId,
        quantidadeAtual: estoqueAtual,
        estoqueMinimo,
        consumoMedioDiario,
        quantidadeSugerida: toNumber(existing.quantidadeSugerida),
        coberturaDias: DEFAULT_COVERAGE_DAYS,
        origem: "MANUAL",
      },
      update: {
        supplierId,
        quantidadeAtual: estoqueAtual,
        estoqueMinimo,
        consumoMedioDiario,
      },
    });
    return;
  }

  if (!temHistoricoMovimentacao) {
    if (existing) {
      await db.purchaseSuggestion.delete({ where: { produtoId } });
    }
    return;
  }

  if (quantidadeSugeridaAutomatica <= 0) {
    if (existing) {
      await db.purchaseSuggestion.delete({ where: { produtoId } });
    }
    return;
  }

  await db.purchaseSuggestion.upsert({
    where: { produtoId },
    create: {
      produtoId,
      supplierId,
      quantidadeAtual: estoqueAtual,
      estoqueMinimo,
      consumoMedioDiario,
      quantidadeSugerida: round2(quantidadeSugeridaAutomatica),
      coberturaDias: DEFAULT_COVERAGE_DAYS,
      origem: "AUTOMATICA",
    },
    update: {
      supplierId,
      quantidadeAtual: estoqueAtual,
      estoqueMinimo,
      consumoMedioDiario,
      quantidadeSugerida: round2(quantidadeSugeridaAutomatica),
      coberturaDias: DEFAULT_COVERAGE_DAYS,
    },
  });
}
