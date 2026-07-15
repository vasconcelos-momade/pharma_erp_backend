import {
  syncStockBalanceCache,
  type StockTx,
} from "./produto-stock.service";
import {
  getLoteQuantidadeFromMovements,
  syncLoteStockBalanceCache,
} from "./lote-stock.service";

type PurchaseLotRecord = {
  id: bigint;
  fornecedorId: bigint | null;
  quantidadeInicial: unknown;
  precoVenda: unknown | null;
};

type PurchaseReceivingTx = StockTx & {
  produto: {
    findUnique: (args: {
      where: { id: bigint };
    }) => Promise<{ id: bigint; nome?: string } | null>;
  };
  lote: {
    findMany: NonNullable<StockTx["lote"]>["findMany"];
    findFirst: (args: {
      where: Record<string, unknown>;
      orderBy?: Record<string, "asc" | "desc">;
    }) => Promise<PurchaseLotRecord | null>;
    create: (args: {
      data: Record<string, unknown>;
    }) => Promise<{ id: bigint }>;
    update: (args: {
      where: { id: bigint };
      data: Record<string, unknown>;
    }) => Promise<{ id: bigint }>;
  };
  estoqueMovimento: {
    create: (args: {
      data: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  historicoPreco: {
    create: (args: {
      data: Record<string, unknown>;
    }) => Promise<unknown>;
  };
};

export interface PurchaseReceivingItemInput {
  produtoId: bigint;
  fornecedorId: bigint;
  numeroLote: string;
  dataValidade: string | Date;
  quantidade: number;
  precoCompra: number;
  precoVenda: number;
  userId: bigint;
}

export interface PurchaseReceivingItemOptions {
  salePriceMode: "truthy" | "nullish";
}

export interface PurchaseReceivingItemResult {
  loteId: bigint;
  produtoId: bigint;
  dataValidade: Date;
  estoqueAnterior: number;
  estoqueFinal: number;
  precoVendaLote: number;
}

export function normalizeExpiryDate(value: string | Date): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data de validade inválida");
  }

  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function getNormalizedExpiryRange(value: string | Date): { start: Date; end: Date } {
  const start = normalizeExpiryDate(value);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function resolvePrecoVendaLoteInput(
  precoVenda: number | null | undefined,
  mode: PurchaseReceivingItemOptions["salePriceMode"],
): number {
  if (mode === "truthy") {
    const preco = Number(precoVenda ?? 0);
    if (!Number.isFinite(preco) || preco <= 0) {
      throw new Error("Preço de venda do lote é obrigatório e deve ser superior a zero.");
    }
    return preco;
  }
  if (precoVenda == null) {
    throw new Error("Preço de venda do lote é obrigatório.");
  }
  const preco = Number(precoVenda);
  if (!Number.isFinite(preco) || preco <= 0) {
    throw new Error("Preço de venda do lote deve ser superior a zero.");
  }
  return preco;
}

export async function receivePurchaseItemStock(
  tx: PurchaseReceivingTx,
  input: PurchaseReceivingItemInput,
  options: PurchaseReceivingItemOptions,
): Promise<PurchaseReceivingItemResult> {
  const numeroLote = input.numeroLote.trim();
  if (!numeroLote) {
    throw new Error("Número do lote é obrigatório");
  }

  if (
    input.dataValidade == null ||
    (typeof input.dataValidade === "string" && input.dataValidade.trim().length === 0)
  ) {
    throw new Error("Data de validade é obrigatória");
  }

  const produto = await tx.produto.findUnique({
    where: { id: input.produtoId },
  });

  if (!produto) {
    throw new Error(`Produto ${input.produtoId} não encontrado`);
  }

  const { start: dataValidadeInicio, end: dataValidadeFim } = getNormalizedExpiryRange(
    input.dataValidade,
  );
  const precoVendaLote = resolvePrecoVendaLoteInput(input.precoVenda, options.salePriceMode);

  await (tx as { $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> })
    .$executeRaw`SELECT id FROM produtos WHERE id = ${produto.id} FOR UPDATE`;
  await (tx as { $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> })
    .$executeRaw`SELECT id FROM lotes WHERE produtoId = ${produto.id} AND deletedAt IS NULL FOR UPDATE`;

  const loteExistente = await tx.lote.findFirst({
    where: {
      produtoId: produto.id,
      numeroLote,
      dataValidade: {
        gte: dataValidadeInicio,
        lt: dataValidadeFim,
      },
      deletedAt: null,
    },
    orderBy: { id: "asc" },
  });

  const precoAnteriorLote = loteExistente ? Number(loteExistente.precoVenda ?? 0) : 0;
  const estoqueAnterior = loteExistente
    ? await getLoteQuantidadeFromMovements(tx, loteExistente.id)
    : 0;

  const lote = loteExistente
    ? await tx.lote.update({
        where: { id: loteExistente.id },
        data: {
          quantidadeInicial: { increment: input.quantidade },
          fornecedorId: loteExistente.fornecedorId ?? input.fornecedorId,
          precoCompra: input.precoCompra,
          precoVenda: precoVendaLote,
          ativo: true,
        },
      })
    : await tx.lote.create({
        data: {
          produtoId: produto.id,
          fornecedorId: input.fornecedorId,
          numeroLote,
          dataValidade: dataValidadeInicio,
          quantidadeInicial: input.quantidade,
          precoCompra: input.precoCompra,
          precoVenda: precoVendaLote,
          ativo: true,
        },
      });

  const estoqueFinal = estoqueAnterior + input.quantidade;

  await tx.estoqueMovimento.create({
    data: {
      produtoId: produto.id,
      loteId: lote.id,
      userId: input.userId,
      tipo: "COMPRA",
      quantidade: input.quantidade,
      estoqueAnterior,
      estoqueFinal,
      origem: "COMPRA",
    },
  });

  await syncLoteStockBalanceCache(tx, { id: lote.id });
  await syncStockBalanceCache(tx, produto.id);

  await tx.historicoPreco.create({
    data: {
      produtoId: produto.id,
      fornecedorId: input.fornecedorId,
      precoAnterior: precoAnteriorLote,
      precoNovo: precoVendaLote,
      variacao: precoVendaLote - precoAnteriorLote,
    },
  });

  return {
    loteId: lote.id,
    produtoId: produto.id,
    dataValidade: dataValidadeInicio,
    estoqueAnterior,
    estoqueFinal,
    precoVendaLote,
  };
}
