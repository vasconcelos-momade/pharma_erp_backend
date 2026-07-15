import { describe, expect, test } from "bun:test";

import {
  resolvePrincipalSupplierId,
  resolvePrincipalSupplierName,
} from "./purchase-supplier.util";

describe("purchase-supplier.util", () => {
  test("resolvePrincipalSupplierId prefere fornecedorPrincipal", () => {
    const id = resolvePrincipalSupplierId([
      { fornecedorPrincipal: false, fornecedorId: 1n },
      { fornecedorPrincipal: true, fornecedorId: 9n },
    ]);
    expect(id).toBe(9n);
  });

  test("resolvePrincipalSupplierId usa o primeiro quando não há principal", () => {
    const id = resolvePrincipalSupplierId([
      { fornecedorPrincipal: false, fornecedorId: 4n },
      { fornecedorPrincipal: false, fornecedorId: 7n },
    ]);
    expect(id).toBe(4n);
  });

  test("resolvePrincipalSupplierName usa nome persistido", () => {
    expect(
      resolvePrincipalSupplierName([], { nome: "Farmácia X" }),
    ).toBe("Farmácia X");
  });
});
