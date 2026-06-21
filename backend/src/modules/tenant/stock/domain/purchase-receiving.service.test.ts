import { describe, expect, mock, test } from "bun:test";
import {
  getNormalizedExpiryRange,
  normalizeExpiryDate,
  receivePurchaseItemStock,
} from "./purchase-receiving.service";

function createTx(overrides: Partial<any> = {}) {
  return {
    $executeRaw: mock(async () => []),
    produto: {
      findUnique: mock(async () => ({
        id: 101n,
        precoVenda: 50,
      })),
      update: mock(async () => ({})),
      ...(overrides.produto ?? {}),
    },
    lote: {
      findFirst: mock(async () => null),
      create: mock(async () => ({ id: 500n })),
      update: mock(async () => ({ id: 501n })),
      findMany: mock(async () => []),
      ...(overrides.lote ?? {}),
    },
    stockBalance: {
      findUnique: mock(async () => null),
      upsert: mock(async () => ({})),
      updateMany: mock(async () => ({})),
      ...(overrides.stockBalance ?? {}),
    },
    estoqueMovimento: {
      create: mock(async () => ({})),
      ...(overrides.estoqueMovimento ?? {}),
    },
    historicoPreco: {
      create: mock(async () => ({})),
      ...(overrides.historicoPreco ?? {}),
    },
  };
}

describe("normalizeExpiryDate", () => {
  test("normaliza a data para o início do dia UTC", () => {
    const normalized = normalizeExpiryDate("2026-06-08T18:45:22.000Z");
    expect(normalized.toISOString()).toBe("2026-06-08T00:00:00.000Z");
  });

  test("retorna range diário consistente", () => {
    const range = getNormalizedExpiryRange("2026-06-08T23:59:59.000Z");
    expect(range.start.toISOString()).toBe("2026-06-08T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-06-09T00:00:00.000Z");
  });
});

describe("receivePurchaseItemStock", () => {
  test("cria lote novo, reconcilia stock e gera movimento", async () => {
    let lotesCriados = false;
    const tx = createTx({
      lote: {
        findMany: mock(async () =>
          lotesCriados ? [{ quantidadeAtual: 10 }] : [],
        ),
        create: mock(async () => {
          lotesCriados = true;
          return { id: 500n };
        }),
      },
    });

    const result = await receivePurchaseItemStock(
      tx,
      {
        produtoId: 101n,
        fornecedorId: 20n,
        numeroLote: "LT-001",
        dataValidade: "2026-06-08T13:00:00.000Z",
        quantidade: 10,
        precoCompra: 20,
        precoVenda: 60,
        userId: 7n,
      },
      { salePriceMode: "nullish" },
    );

    expect(result.loteId).toBe(500n);
    expect(tx.lote.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.lote.create).toHaveBeenCalledTimes(1);
    expect(tx.lote.update).toHaveBeenCalledTimes(0);
    expect(tx.stockBalance.upsert).toHaveBeenCalledTimes(2);
    expect(tx.estoqueMovimento.create).toHaveBeenCalledTimes(1);
    expect(tx.historicoPreco.create).toHaveBeenCalledTimes(1);

    const loteCreatePayload = tx.lote.create.mock.calls[0]![0].data;
    expect(loteCreatePayload.numeroLote).toBe("LT-001");
    expect(loteCreatePayload.dataValidade.toISOString()).toBe("2026-06-08T00:00:00.000Z");

    const movimentoPayload = tx.estoqueMovimento.create.mock.calls[0]![0].data;
    expect(movimentoPayload.tipo).toBe("ENTRADA");
    expect(movimentoPayload.origem).toBe("COMPRA_FORNECEDOR");
    expect(movimentoPayload.estoqueAnterior).toBe(0);
    expect(movimentoPayload.estoqueFinal).toBe(10);
  });

  test("reutiliza lote existente e incrementa quantidades", async () => {
    const tx = createTx({
      lote: {
        findFirst: mock(async () => ({
          id: 900n,
          fornecedorId: null,
          quantidadeInicial: 5,
          quantidadeAtual: 5,
        })),
        update: mock(async () => ({ id: 900n })),
        findMany: mock(async () => [{ quantidadeAtual: 7 }, { quantidadeAtual: 8 }]),
      },
      stockBalance: {
        findUnique: mock(async () => ({
          quantidadeTotal: 5,
          quantidadeReservada: 1,
          quantidadeDisponivel: 4,
        })),
      },
    });

    const result = await receivePurchaseItemStock(
      tx,
      {
        produtoId: 101n,
        fornecedorId: 20n,
        numeroLote: "LT-001",
        dataValidade: "2026-06-08",
        quantidade: 10,
        precoCompra: 20,
        precoVenda: null,
        userId: 7n,
      },
      { salePriceMode: "nullish" },
    );

    expect(result.loteId).toBe(900n);
    expect(tx.lote.create).toHaveBeenCalledTimes(0);
    expect(tx.lote.update).toHaveBeenCalledTimes(1);

    const loteUpdatePayload = tx.lote.update.mock.calls[0]![0].data;
    expect(loteUpdatePayload.quantidadeInicial).toEqual({ increment: 10 });
    expect(loteUpdatePayload.quantidadeAtual).toEqual({ increment: 10 });
    expect(loteUpdatePayload.fornecedorId).toBe(20n);

    const stockPayload = tx.stockBalance.upsert.mock.calls[0]![0];
    expect(stockPayload.update.quantidadeTotal).toBe(15);
    expect(stockPayload.update.quantidadeDisponivel).toBe(14);
  });

  test("múltiplos recebimentos do mesmo lote reutilizam o registo normalizado", async () => {
    const lotes: Array<{
      id: bigint;
      produtoId: bigint;
      fornecedorId: bigint | null;
      numeroLote: string;
      dataValidade: Date;
      quantidadeInicial: number;
      quantidadeAtual: number;
      ativo: boolean;
      deletedAt: Date | null;
      precoCompra: number;
      precoVenda: number;
    }> = [];
    let nextLoteId = 1n;
    let produto = {
      id: 101n,
      precoVenda: 50,
    };
    let stockBalance: {
      quantidadeTotal: number;
      quantidadeReservada: number;
      quantidadeDisponivel: number;
    } | null = null;

    const tx = {
      $executeRaw: mock(async () => []),
      produto: {
        findUnique: mock(async () => produto),
        update: mock(async ({ data }: { data: Record<string, unknown> }) => {
          produto = { ...produto, ...data };
          return produto;
        }),
      },
      lote: {
        findFirst: mock(async ({ where }: { where: any }) => {
          return lotes.find((lote) =>
            lote.produtoId === where.produtoId &&
            lote.numeroLote === where.numeroLote &&
            lote.deletedAt === null &&
            lote.dataValidade >= where.dataValidade.gte &&
            lote.dataValidade < where.dataValidade.lt,
          ) ?? null;
        }),
        create: mock(async ({ data }: { data: any }) => {
          const lote = {
            id: nextLoteId++,
            produtoId: data.produtoId,
            fornecedorId: data.fornecedorId,
            numeroLote: data.numeroLote,
            dataValidade: data.dataValidade,
            quantidadeInicial: data.quantidadeInicial,
            quantidadeAtual: data.quantidadeAtual,
            ativo: data.ativo,
            deletedAt: null,
            precoCompra: data.precoCompra,
            precoVenda: data.precoVenda,
          };
          lotes.push(lote);
          return lote;
        }),
        update: mock(async ({ where, data }: { where: { id: bigint }; data: any }) => {
          const lote = lotes.find((current) => current.id === where.id)!;
          lote.quantidadeInicial += data.quantidadeInicial.increment;
          lote.quantidadeAtual += data.quantidadeAtual.increment;
          lote.fornecedorId = data.fornecedorId;
          lote.precoCompra = data.precoCompra;
          lote.precoVenda = data.precoVenda;
          lote.ativo = data.ativo;
          return lote;
        }),
        findMany: mock(async () => lotes.map((lote) => ({ quantidadeAtual: lote.quantidadeAtual }))),
      },
      stockBalance: {
        findUnique: mock(async () => stockBalance),
        upsert: mock(async ({ create, update }: { create: any; update: any }) => {
          stockBalance = stockBalance
            ? {
                quantidadeTotal: update.quantidadeTotal,
                quantidadeReservada: stockBalance.quantidadeReservada,
                quantidadeDisponivel: update.quantidadeDisponivel,
              }
            : {
                quantidadeTotal: create.quantidadeTotal,
                quantidadeReservada: create.quantidadeReservada,
                quantidadeDisponivel: create.quantidadeDisponivel,
              };
          return stockBalance;
        }),
        updateMany: mock(async () => ({})),
      },
      estoqueMovimento: {
        create: mock(async () => ({})),
      },
      historicoPreco: {
        create: mock(async () => ({})),
      },
    };

    const first = await receivePurchaseItemStock(
      tx,
      {
        produtoId: 101n,
        fornecedorId: 20n,
        numeroLote: "LT-SEQ",
        dataValidade: "2026-06-08T08:10:00.000Z",
        quantidade: 10,
        precoCompra: 20,
        precoVenda: 60,
        userId: 7n,
      },
      { salePriceMode: "nullish" },
    );

    const second = await receivePurchaseItemStock(
      tx,
      {
        produtoId: 101n,
        fornecedorId: 20n,
        numeroLote: "LT-SEQ",
        dataValidade: "2026-06-08T19:45:00.000Z",
        quantidade: 5,
        precoCompra: 22,
        precoVenda: 65,
        userId: 7n,
      },
      { salePriceMode: "nullish" },
    );

    expect(first.loteId).toBe(1n);
    expect(second.loteId).toBe(1n);
    expect(lotes).toHaveLength(1);
    expect(lotes[0]!.quantidadeInicial).toBe(15);
    expect(lotes[0]!.quantidadeAtual).toBe(15);
    expect(first.estoqueAnterior).toBe(0);
    expect(first.estoqueFinal).toBe(10);
    expect(second.estoqueAnterior).toBe(10);
    expect(second.estoqueFinal).toBe(15);
  });

  test("em modo truthy não actualiza preço de venda quando precoVenda é zero", async () => {
    const tx = createTx();

    await receivePurchaseItemStock(
      tx,
      {
        produtoId: 101n,
        fornecedorId: 20n,
        numeroLote: "LT-002",
        dataValidade: "2026-06-08",
        quantidade: 3,
        precoCompra: 12,
        precoVenda: 0,
        userId: 7n,
      },
      { salePriceMode: "truthy" },
    );

    expect(tx.produto.update).not.toHaveBeenCalled();
    const priceUpdatePayload = tx.produto.update.mock.calls.find(
      (call) => call[0].data.precoVenda !== undefined,
    )?.[0].data;
    expect(priceUpdatePayload).toBeUndefined();
    const historicoPayload = tx.historicoPreco.create.mock.calls[0]![0].data;
    expect(historicoPayload.precoNovo).toBe(50);
    expect(historicoPayload.variacao).toBe(0);
  });

  test("valida obrigatoriedade de numeroLote e dataValidade", async () => {
    const tx = createTx();

    await expect(
      receivePurchaseItemStock(
        tx,
        {
          produtoId: 101n,
          fornecedorId: 20n,
          numeroLote: " ",
          dataValidade: "2026-06-08",
          quantidade: 1,
          precoCompra: 1,
          userId: 7n,
        },
        { salePriceMode: "nullish" },
      ),
    ).rejects.toThrow("Número do lote é obrigatório");

    await expect(
      receivePurchaseItemStock(
        tx,
        {
          produtoId: 101n,
          fornecedorId: 20n,
          numeroLote: "LT-003",
          dataValidade: " ",
          quantidade: 1,
          precoCompra: 1,
          userId: 7n,
        },
        { salePriceMode: "nullish" },
      ),
    ).rejects.toThrow("Data de validade é obrigatória");
  });
});
