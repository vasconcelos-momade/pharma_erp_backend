import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { NotFoundApiError, ValidationApiError } from "../../../../../../shared/http/api-error";
import { receivePurchaseItemStock } from "../../../domain/purchase-receiving.service";

export interface EntradaCompraInput {
  produtoId: string;
  fornecedorId: string;
  numeroLote: string;
  dataValidade: string;
  quantidade: number;
  precoCompra: number;
  precoVenda: number;
  userId: string;
}

export class EntradaCompraUseCase {
  async execute(data: EntradaCompraInput) {
    if (data.quantidade <= 0) {
      throw new ValidationApiError("Quantidade deve ser superior a zero");
    }

    const prisma = getPrisma();

    return prisma.$transaction(async (tx: any) => {
      const produto = await tx.produto.findUnique({
        where: { id: BigInt(data.produtoId) },
      });
      if (!produto || produto.deletedAt != null || !produto.ativo) {
        throw new NotFoundApiError("Produto não encontrado");
      }

      const fornecedor = await tx.fornecedor.findUnique({
        where: { id: BigInt(data.fornecedorId) },
      });
      if (!fornecedor || fornecedor.deletedAt != null || !fornecedor.ativo) {
        throw new NotFoundApiError("Fornecedor não encontrado");
      }

      const result = await receivePurchaseItemStock(
        tx,
        {
          produtoId: BigInt(data.produtoId),
          fornecedorId: BigInt(data.fornecedorId),
          numeroLote: data.numeroLote,
          dataValidade: data.dataValidade,
          quantidade: data.quantidade,
          precoCompra: data.precoCompra,
          precoVenda: data.precoVenda,
          userId: BigInt(data.userId),
        },
        { salePriceMode: "nullish" },
      );

      return {
        message: "Entrada de compra registada com sucesso",
        loteId: result.loteId.toString(),
        produtoId: result.produtoId.toString(),
        estoqueAnterior: result.estoqueAnterior,
        estoqueFinal: result.estoqueFinal,
      };
    });
  }
}
