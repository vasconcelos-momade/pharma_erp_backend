import { describe, expect, test } from "bun:test";

import { signedMovementDelta } from "./lote-stock.service";

describe("signedMovementDelta", () => {
  test("COMPRA incrementa stock como ENTRADA", () => {
    expect(
      signedMovementDelta({ tipo: "COMPRA", quantidade: 15 }),
    ).toBe(15);
  });

  test("ENTRADA incrementa stock", () => {
    expect(
      signedMovementDelta({ tipo: "ENTRADA", quantidade: 10 }),
    ).toBe(10);
  });

  test("SAIDA decrementa stock", () => {
    expect(
      signedMovementDelta({ tipo: "SAIDA", quantidade: 3 }),
    ).toBe(-3);
  });

  test("AJUSTE usa delta entre estoque final e anterior", () => {
    expect(
      signedMovementDelta({
        tipo: "AJUSTE",
        quantidade: 0,
        estoqueAnterior: 5,
        estoqueFinal: 12,
      }),
    ).toBe(7);
  });

  test("QUARENTENA não altera stock físico", () => {
    expect(
      signedMovementDelta({ tipo: "QUARENTENA", quantidade: 50 }),
    ).toBe(0);
  });
});
