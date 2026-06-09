import { afterEach, describe, expect, mock, test } from "bun:test";
import { TenantPrismaFactory } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ValidationApiError } from "../../../../../../shared/http/api-error";
import { ConfirmPurchaseUseCase } from "./confirm-purchase.use-case";

const originalGetClient = TenantPrismaFactory.getClient;

afterEach(() => {
  (TenantPrismaFactory as any).getClient = originalGetClient;
});

describe("ConfirmPurchaseUseCase", () => {
  test("impede confirmação quando a compra não possui itens", async () => {
    const tx = {
      compra: {
        findUnique: mock(async () => ({
          id: 10n,
          fornecedorId: 20n,
          numeroDocumento: "DOC-1",
          total: 0,
          status: "PENDENTE",
          itens: [],
        })),
      },
    };

    (TenantPrismaFactory as any).getClient = mock(() => ({
      $transaction: async (callback: (db: typeof tx) => Promise<unknown>) => callback(tx),
    }));

    await expect(new ConfirmPurchaseUseCase().execute("10", "7")).rejects.toBeInstanceOf(
      ValidationApiError,
    );
  });
});
