import { syncProductStockFromLotes, type StockTx } from "./produto-stock.service";

type PurchaseProductRecord = {
  id: bigint;
  precoVenda: unknown;
  estoqueAtual?: unknown;
  nome?: string;
};

type PurchaseLotRecord = {
  id: bigint;
  fornecedorId: bigint | null;
  quantidadeInicial: unknown;
  quantidadeAtual: unknown;
};

type PurchaseReceivingTx = Omit<StockTx, "produto" | "lote"> & {
  produto: {
    findUnique: (args: {
      where: { id: bigint };
    }) => Promise<PurchaseProductRecord | null>;
    update: (args: {
      where: { id: bigint };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
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
  precoVenda?: number | null;
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

function shouldUseExplicitSalePrice(
  precoVenda: number | null | undefined,
  mode: PurchaseReceivingItemOptions["salePriceMode"],
): boolean {
  if (mode === "truthy") {
    return Boolean(precoVenda);
  }
  return precoVenda != null;
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
  const hasExplicitSalePrice = shouldUseExplicitSalePrice(input.precoVenda, options.salePriceMode);
  const precoVendaLote = hasExplicitSalePrice
    ? Number(input.precoVenda)
    : Number(produto.precoVenda);

  await (tx as { $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> })
    .$executeRaw`SELECT id FROM produtos WHERE id = ${produto.id} FOR UPDATE`;
  await (tx as { $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> })
    .$executeRaw`SELECT id FROM lotes WHERE produtoId = ${produto.id} AND deletedAt IS NULL FOR UPDATE`;

  const estoqueAnterior = await syncProductStockFromLotes(tx, produto.id);

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

  const lote = loteExistente
    ? await tx.lote.update({
        where: { id: loteExistente.id },
        data: {
          quantidadeInicial: { increment: input.quantidade },
          quantidadeAtual: { increment: input.quantidade },
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
          quantidadeAtual: input.quantidade,
          precoCompra: input.precoCompra,
          precoVenda: precoVendaLote,
          ativo: true,
        },
      });

  if (hasExplicitSalePrice) {
    await tx.produto.update({
      where: { id: produto.id },
      data: { precoVenda: input.precoVenda },
    });
  }

  const estoqueFinal = await syncProductStockFromLotes(tx, produto.id);

  await tx.estoqueMovimento.create({
    data: {
      produtoId: produto.id,
      loteId: lote.id,
      userId: input.userId,
      tipo: "ENTRADA",
      quantidade: input.quantidade,
      estoqueAnterior,
      estoqueFinal,
      origem: "COMPRA_FORNECEDOR",
    },
  });

  await tx.historicoPreco.create({
    data: {
      produtoId: produto.id,
      fornecedorId: input.fornecedorId,
      precoAnterior: produto.precoVenda,
      precoNovo: precoVendaLote,
      variacao: hasExplicitSalePrice
        ? Number(input.precoVenda) - Number(produto.precoVenda)
        : 0,
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
