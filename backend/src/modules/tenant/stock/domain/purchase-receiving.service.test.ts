import { describe, expect, mock, test } from "bun:test";
import {
  getNormalizedExpiryRange,
  normalizeExpiryDate,
  receivePurchaseItemStock,
} from "./purchase-receiving.service";

function createTx(overrides: Partial<any> = {}) {
  const movements: Array<{ estoqueFinal: number }> = [];

  return {
    $executeRaw: mock(async () => []),
    produto: {
      findUnique: mock(async () => ({
        id: 101n,
        nome: "Produto Teste",
      })),
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
      findFirst: mock(async () =>
        movements.length > 0 ? movements[movements.length - 1] : null,
      ),
      create: mock(async ({ data }: { data: { estoqueFinal: number } }) => {
        movements.push({ estoqueFinal: data.estoqueFinal });
        return {};
      }),
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
    const tx = createTx({
      lote: {
        findMany: mock(async () => [{ quantidadeAtual: 10, quantidadeQuarentena: 0 }]),
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
    expect(tx.stockBalance.upsert).toHaveBeenCalledTimes(1);
    expect(tx.estoqueMovimento.create).toHaveBeenCalledTimes(1);
    expect(tx.historicoPreco.create).toHaveBeenCalledTimes(1);

    const loteCreatePayload = tx.lote.create.mock.calls[0]![0].data;
    expect(loteCreatePayload.numeroLote).toBe("LT-001");
    expect(loteCreatePayload.precoVenda).toBe(60);
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
          precoVenda: 50,
        })),
        update: mock(async () => ({ id: 900n })),
        findMany: mock(async () => [
          { quantidadeAtual: 15, quantidadeQuarentena: 0 },
        ]),
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
        precoVenda: 55,
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
    expect(loteUpdatePayload.precoVenda).toBe(55);
    expect(loteUpdatePayload.fornecedorId).toBe(20n);
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
      quantidadeQuarentena: number;
      ativo: boolean;
      deletedAt: Date | null;
      precoCompra: number;
      precoVenda: number;
    }> = [];
    const movements: Array<{ estoqueFinal: number }> = [];
    let nextLoteId = 1n;
    let stockBalance: {
      quantidadeTotal: number;
      quantidadeReservada: number;
      quantidadeDisponivel: number;
    } | null = null;

    const tx = {
      $executeRaw: mock(async () => []),
      produto: {
        findUnique: mock(async () => ({ id: 101n, nome: "Produto Teste" })),
      },
      lote: {
        findFirst: mock(async ({ where }: { where: any }) => {
          return (
            lotes.find(
              (lote) =>
                lote.produtoId === where.produtoId &&
                lote.numeroLote === where.numeroLote &&
                lote.deletedAt === null &&
                lote.dataValidade >= where.dataValidade.gte &&
                lote.dataValidade < where.dataValidade.lt,
            ) ?? null
          );
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
            quantidadeQuarentena: 0,
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
        findMany: mock(async () =>
          lotes.map((lote) => ({
            quantidadeAtual: lote.quantidadeAtual,
            quantidadeQuarentena: lote.quantidadeQuarentena,
          })),
        ),
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
        findFirst: mock(async () =>
          movements.length > 0 ? movements[movements.length - 1] : null,
        ),
        create: mock(async ({ data }: { data: { estoqueFinal: number } }) => {
          movements.push({ estoqueFinal: data.estoqueFinal });
          return {};
        }),
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

  test("rejeita preço de venda inválido no modo truthy", async () => {
    const tx = createTx();

    await expect(
      receivePurchaseItemStock(
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
      ),
    ).rejects.toThrow("Preço de venda do lote é obrigatório e deve ser superior a zero.");
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
          precoVenda: 10,
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
          precoVenda: 10,
          userId: 7n,
        },
        { salePriceMode: "nullish" },
      ),
    ).rejects.toThrow("Data de validade é obrigatória");
  });
});
