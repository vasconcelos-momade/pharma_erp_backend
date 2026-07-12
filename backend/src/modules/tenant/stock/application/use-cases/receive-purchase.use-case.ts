import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ValidationApiError } from "../../../../../shared/http/api-error";
import {
  normalizeExpiryDate,
  receivePurchaseItemStock,
} from "../../domain/purchase-receiving.service";

export interface ReceivePurchaseDTO {
  fornecedorId: string;
  numeroDocumento: string;
  userId: string;
  items: {
    produtoId: string;
    numeroLote: string;
    dataValidade: string;
    quantidade: number;
    precoCompra: number;
    precoVenda?: number;
  }[];
}

export class ReceivePurchaseUseCase {
  async execute(data: ReceivePurchaseDTO) {
    if (data.items.length === 0) {
      throw new ValidationApiError("Informe pelo menos um item");
    }

    const prisma = getPrisma();

    return await prisma.$transaction(async (tx: any) => {
      const results = [];

      for (const item of data.items) {
        const produtoId = BigInt(item.produtoId);
        const dataValidade = normalizeExpiryDate(item.dataValidade);

        const result = await receivePurchaseItemStock(
          tx,
          {
            produtoId,
            fornecedorId: BigInt(data.fornecedorId),
            numeroLote: item.numeroLote,
            dataValidade,
            quantidade: item.quantidade,
            precoCompra: item.precoCompra,
            precoVenda: item.precoVenda ?? null,
            userId: BigInt(data.userId),
          },
          {
            salePriceMode: "truthy",
          },
        );

        results.push({
          loteId: result.loteId.toString(),
          produtoId: result.produtoId.toString(),
          quantidade: item.quantidade,
          estoqueAnterior: result.estoqueAnterior,
          estoqueFinal: result.estoqueFinal,
        });
      }

      const totalCompra = data.items.reduce(
        (sum, item) => sum + item.quantidade * item.precoCompra,
        0,
      );

      return {
        message: "Entrada de compra registada com sucesso",
        numeroDocumento: data.numeroDocumento.trim(),
        total: totalCompra,
        items: results,
      };
    });
  }
}
