import { describe, expect, mock, test } from "bun:test";
import { confirmRequisitionStockMovements } from "./requisition-confirmation.service";

type MovementRow = {
  produtoId: bigint;
  loteId: bigint | null;
  tipo: string;
  quantidade: number;
  estoqueAnterior: number;
  estoqueFinal: number;
  deletedAt: null;
  id: bigint;
};

function createTx(overrides: Partial<any> = {}) {
  let stockBalance = {
    quantidadeTotal: 20,
    quantidadeReservada: 0,
    quantidadeDisponivel: 20,
  };
  const movements: MovementRow[] = [];
  const loteBalances = new Map<string, { quantidadeTotal: number; quantidadeDisponivel: number }>();
  let nextMovementId = 1n;

  return {
    $executeRaw: mock(async () => []),
    produto: {
      findUnique: mock(async () => ({
        id: 10n,
        nomeComercial: "Produto Teste",
      })),
      update: mock(async () => ({})),
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
    loteStockBalance: {
      findUnique: mock(async ({ where }: { where: { loteId: bigint } }) => {
        return loteBalances.get(where.loteId.toString()) ?? null;
      }),
      upsert: mock(
        async ({
          where,
          create,
          update,
        }: {
          where: { loteId: bigint };
          create: { quantidadeTotal: number; quantidadeDisponivel: number };
          update: { quantidadeTotal: number; quantidadeDisponivel: number };
        }) => {
          const key = where.loteId.toString();
          const next = loteBalances.has(key)
            ? {
                quantidadeTotal: Number(update.quantidadeTotal),
                quantidadeDisponivel: Number(update.quantidadeDisponivel),
              }
            : {
                quantidadeTotal: Number(create.quantidadeTotal),
                quantidadeDisponivel: Number(create.quantidadeDisponivel),
              };
          loteBalances.set(key, next);
          return next;
        },
      ),
      ...(overrides.loteStockBalance ?? {}),
    },
    estoqueMovimento: {
      findFirst: mock(async ({ where }: { where: { produtoId?: bigint; loteId?: bigint } }) => {
        const filtered = movements
          .filter((movement) => {
            if (where.produtoId != null && movement.produtoId !== where.produtoId) return false;
            if (where.loteId != null && movement.loteId !== where.loteId) return false;
            return true;
          })
          .sort((a, b) => Number(b.id - a.id));
        return filtered[0] ?? null;
      }),
      findMany: mock(async ({ where }: { where: { produtoId?: bigint; loteId?: bigint } }) => {
        return movements.filter((movement) => {
          if (where.produtoId != null && movement.produtoId !== where.produtoId) return false;
          if (where.loteId != null && movement.loteId !== where.loteId) return false;
          return true;
        });
      }),
      create: mock(
        async ({
          data,
        }: {
          data: {
            produtoId: bigint;
            loteId: bigint | null;
            tipo: string;
            quantidade: number;
            estoqueAnterior: number;
            estoqueFinal: number;
          };
        }) => {
          const movement: MovementRow = {
            id: nextMovementId++,
            produtoId: data.produtoId,
            loteId: data.loteId,
            tipo: data.tipo,
            quantidade: data.quantidade,
            estoqueAnterior: data.estoqueAnterior,
            estoqueFinal: data.estoqueFinal,
            deletedAt: null,
          };
          movements.push(movement);
          return movement;
        },
      ),
      ...(overrides.estoqueMovimento ?? {}),
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
    const tx = createTx({
      lote: {
        findUnique: mock(async () => ({
          id: 5n,
          produtoId: 10n,
          quantidadeQuarentena: 0,
          numeroLote: "L1",
        })),
        findMany: mock(async () => [{ id: 5n, quantidadeQuarentena: 0 }]),
      },
      loteStockBalance: {
        findUnique: mock(async () => ({
          quantidadeTotal: 10,
          quantidadeDisponivel: 10,
        })),
        upsert: mock(async () => ({})),
      },
      estoqueMovimento: {
        findFirst: mock(async () => ({ estoqueFinal: 10 })),
        findMany: mock(async () => [
          {
            tipo: "ENTRADA",
            quantidade: 10,
            estoqueAnterior: 0,
            estoqueFinal: 10,
          },
        ]),
        create: mock(async () => ({})),
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
    expect(tx.lote.update).not.toHaveBeenCalled();
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
      estoqueMovimento: {
        findFirst: mock(async () => null),
        findMany: mock(async () => []),
        create: mock(async () => ({})),
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
