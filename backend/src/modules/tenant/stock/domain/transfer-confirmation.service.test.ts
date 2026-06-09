import { describe, expect, mock, test } from "bun:test";
import { confirmTransferStockMovements } from "./transfer-confirmation.service";

function createTx(overrides: Partial<any> = {}) {
  return {
    $executeRaw: mock(async () => []),
    produto: {
      findUnique: mock(async () => ({
        id: 10n,
        nome: "Produto Teste",
        estoqueAtual: 20,
      })),
      update: mock(async () => ({})),
      ...(overrides.produto ?? {}),
    },
    stockBalance: {
      findUnique: mock(async () => ({
        quantidadeTotal: 20,
        quantidadeReservada: 0,
        quantidadeDisponivel: 20,
      })),
      upsert: mock(async () => ({})),
      updateMany: mock(async () => ({})),
    },
    lote: {
      findUnique: mock(async () => ({
        id: 5n,
        produtoId: 10n,
        quantidadeAtual: 8,
        numeroLote: "LT-1",
      })),
      findMany: mock(async () => []),
      ...(overrides.lote ?? {}),
    },
    estoqueMovimento: {
      create: mock(async () => ({})),
    },
  };
}

describe("confirmTransferStockMovements", () => {
  test("tipo SAIDA gera apenas movimento SAIDA documental", async () => {
    const tx = createTx();

    await confirmTransferStockMovements(tx, {
      transferenciaId: 1n,
      numeroDocumento: "TRF-1",
      origem: "A",
      destino: "B",
      tipo: "SAIDA",
      userId: 2n,
      itens: [{ id: 100n, produtoId: 10n, loteId: 5n, quantidade: 3 }],
    });

    expect(tx.estoqueMovimento.create).toHaveBeenCalledTimes(1);
    const payload = tx.estoqueMovimento.create.mock.calls[0]![0].data;
    expect(payload.tipo).toBe("SAIDA");
    expect(payload.observacoes).toContain("SAIDA DOCUMENTAL");
    expect(payload.estoqueAnterior).toBe(8);
    expect(payload.estoqueFinal).toBe(8);
  });

  test("tipo ENTRADA gera apenas movimento ENTRADA documental", async () => {
    const tx = createTx();

    await confirmTransferStockMovements(tx, {
      transferenciaId: 2n,
      numeroDocumento: "TRF-2",
      origem: "C",
      destino: "D",
      tipo: "ENTRADA",
      userId: 2n,
      itens: [{ id: 101n, produtoId: 10n, loteId: null, quantidade: 4 }],
    });

    expect(tx.estoqueMovimento.create).toHaveBeenCalledTimes(1);
    const payload = tx.estoqueMovimento.create.mock.calls[0]![0].data;
    expect(payload.tipo).toBe("ENTRADA");
    expect(payload.observacoes).toContain("ENTRADA DOCUMENTAL");
  });

  test("tipo SAIDA valida stock insuficiente", async () => {
    const tx = createTx({
      lote: {
        findUnique: mock(async () => ({
          id: 5n,
          produtoId: 10n,
          quantidadeAtual: 1,
          numeroLote: "LT-1",
        })),
      },
    });

    await expect(
      confirmTransferStockMovements(tx, {
        transferenciaId: 3n,
        numeroDocumento: "TRF-3",
        origem: "E",
        destino: "F",
        tipo: "SAIDA",
        userId: 2n,
        itens: [{ id: 102n, produtoId: 10n, loteId: 5n, quantidade: 5 }],
      }),
    ).rejects.toThrow("Stock insuficiente");
  });
});
