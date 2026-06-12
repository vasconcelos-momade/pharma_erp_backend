import { describe, expect, mock, test } from "bun:test";
import { confirmRequisitionStockMovements } from "./requisition-confirmation.service";

function createTx(overrides: Partial<any> = {}) {
  let stockBalance = {
    quantidadeTotal: 20,
    quantidadeReservada: 0,
    quantidadeDisponivel: 20,
  };

  return {
    $executeRaw: mock(async () => []),
    produto: {
      findUnique: mock(async () => ({
        id: 10n,
        nome: "Produto Teste",
        estoqueAtual: stockBalance.quantidadeTotal,
      })),
      update: mock(async ({ data }: { data: any }) => {
        if (typeof data?.estoqueAtual === "number") {
          stockBalance = {
            ...stockBalance,
            quantidadeTotal: data.estoqueAtual,
            quantidadeDisponivel: data.estoqueAtual,
          };
        }
        return {};
      }),
      ...(overrides.produto ?? {}),
    },
    stockBalance: {
      findUnique: mock(async () => stockBalance),
      upsert: mock(async ({ create, update }: { create: any; update: any }) => {
        if (update?.quantidadeTotal?.decrement != null) {
          stockBalance = {
            ...stockBalance,
            quantidadeTotal:
              stockBalance.quantidadeTotal - update.quantidadeTotal.decrement,
            quantidadeDisponivel:
              stockBalance.quantidadeDisponivel -
              update.quantidadeDisponivel.decrement,
          };
        } else if (update?.quantidadeTotal?.increment != null) {
          stockBalance = {
            ...stockBalance,
            quantidadeTotal:
              stockBalance.quantidadeTotal + update.quantidadeTotal.increment,
            quantidadeDisponivel:
              stockBalance.quantidadeDisponivel +
              update.quantidadeDisponivel.increment,
          };
        } else if (update?.quantidadeTotal != null) {
          stockBalance = {
            quantidadeTotal: Number(update.quantidadeTotal),
            quantidadeReservada: Number(
              update.quantidadeReservada ?? stockBalance.quantidadeReservada,
            ),
            quantidadeDisponivel: Number(
              update.quantidadeDisponivel ?? stockBalance.quantidadeDisponivel,
            ),
          };
        } else {
          stockBalance = {
            quantidadeTotal: Number(create.quantidadeTotal),
            quantidadeReservada: Number(create.quantidadeReservada ?? 0),
            quantidadeDisponivel: Number(create.quantidadeDisponivel ?? 0),
          };
        }
        return stockBalance;
      }),
      updateMany: mock(async () => ({})),
      ...(overrides.stockBalance ?? {}),
    },
    lote: {
      findUnique: mock(async () => null),
      findMany: mock(async () => []),
      update: mock(async () => ({})),
      ...(overrides.lote ?? {}),
    },
    estoqueMovimento: {
      create: mock(async () => ({})),
    },
  };
}

describe("confirmRequisitionStockMovements", () => {
  test("SAIDA sem lote gera movimento com alteracao do stock global", async () => {
    const tx = createTx();

    await confirmRequisitionStockMovements(tx, {
      requisicaoId: 1n,
      numeroDocumento: "REQ-1",
      origem: null,
      destino: "Loja",
      tipo: "SAIDA",
      userId: 2n,
      itens: [{ id: 100n, produtoId: 10n, loteId: null, quantidadeSolicitada: 3 }],
    });

    expect(tx.estoqueMovimento.create).toHaveBeenCalledTimes(1);
    const payload = tx.estoqueMovimento.create.mock.calls[0]![0].data;
    expect(payload.tipo).toBe("SAIDA");
    expect(payload.estoqueAnterior).toBe(20);
    expect(payload.estoqueFinal).toBe(17);
  });

  test("ENTRADA sem lote incrementa stock global", async () => {
    const tx = createTx();

    await confirmRequisitionStockMovements(tx, {
      requisicaoId: 2n,
      numeroDocumento: "REQ-2",
      origem: "Fornecedor",
      destino: null,
      tipo: "ENTRADA",
      userId: 2n,
      itens: [{ id: 101n, produtoId: 10n, loteId: null, quantidadeSolicitada: 4 }],
    });

    expect(tx.estoqueMovimento.create).toHaveBeenCalledTimes(1);
    const payload = tx.estoqueMovimento.create.mock.calls[0]![0].data;
    expect(payload.tipo).toBe("ENTRADA");
    expect(payload.estoqueAnterior).toBe(20);
    expect(payload.estoqueFinal).toBe(24);
  });

  test("SAIDA com lote regista estoque ao nivel do lote", async () => {
    let loteQty = 10;
    const tx = createTx({
      lote: {
        findUnique: mock(async () => ({
          id: 5n,
          produtoId: 10n,
          quantidadeAtual: loteQty,
          numeroLote: "L1",
        })),
        findMany: mock(async () => [{ quantidadeAtual: loteQty }]),
        update: mock(async ({ data }: { data: any }) => {
          if (data.quantidadeAtual?.decrement != null) {
            loteQty -= data.quantidadeAtual.decrement;
          }
          return {};
        }),
      },
    });

    await confirmRequisitionStockMovements(tx, {
      requisicaoId: 3n,
      numeroDocumento: "REQ-3",
      origem: null,
      destino: "Loja",
      tipo: "SAIDA",
      userId: 2n,
      itens: [{ id: 102n, produtoId: 10n, loteId: 5n, quantidadeSolicitada: 3 }],
    });

    const payload = tx.estoqueMovimento.create.mock.calls[0]![0].data;
    expect(payload.estoqueAnterior).toBe(10);
    expect(payload.estoqueFinal).toBe(7);
  });

  test("SAIDA valida stock insuficiente", async () => {
    const tx = createTx({
      stockBalance: {
        findUnique: mock(async () => ({
          quantidadeTotal: 1,
          quantidadeReservada: 0,
          quantidadeDisponivel: 1,
        })),
        upsert: mock(async () => ({})),
        updateMany: mock(async () => ({})),
      },
    });

    await expect(
      confirmRequisitionStockMovements(tx, {
        requisicaoId: 4n,
        numeroDocumento: "REQ-4",
        origem: null,
        destino: "Loja",
        tipo: "SAIDA",
        userId: 2n,
        itens: [{ id: 103n, produtoId: 10n, loteId: null, quantidadeSolicitada: 5 }],
      }),
    ).rejects.toThrow("Stock insuficiente");
  });
});
