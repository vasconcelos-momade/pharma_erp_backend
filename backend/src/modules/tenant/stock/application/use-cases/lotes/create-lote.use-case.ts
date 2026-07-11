import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { NotFoundApiError, ValidationApiError } from "../../../../../../shared/http/api-error";

export interface CreateLoteInput {
  produtoId: string;
  fornecedorId: string;
  numeroLote: string;
  dataValidade: Date;
  precoCompra?: number;
}

export class CreateLoteUseCase {
  async execute(data: CreateLoteInput) {
    const prisma = getPrisma() as any;
    const produtoId = BigInt(data.produtoId);
    const fornecedorId = BigInt(data.fornecedorId);

    return prisma.$transaction(async (tx: any) => {
      const produto = await tx.produto.findUnique({
        where: { id: produtoId },
      });
      if (!produto) {
        throw new NotFoundApiError("Produto nao encontrado");
      }

      const fornecedor = await tx.fornecedor.findUnique({
        where: { id: fornecedorId },
      });
      if (!fornecedor) {
        throw new NotFoundApiError("Fornecedor nao encontrado");
      }

      const existingLote = await tx.lote.findFirst({
        where: {
          produtoId,
          numeroLote: data.numeroLote,
        },
      });
      if (existingLote) {
        throw new ValidationApiError("Lote ja existe para este produto");
      }

      let produtoFornecedor = await tx.produtoFornecedor.findUnique({
        where: {
          produtoId_fornecedorId: {
            produtoId,
            fornecedorId,
          },
        },
      });

      if (!produtoFornecedor) {
        produtoFornecedor = await tx.produtoFornecedor.create({
          data: {
            produtoId,
            fornecedorId,
            precoCompra: data.precoCompra || 0,
          },
        });
      }

      const lote = await tx.lote.create({
        data: {
          produtoId,
          fornecedorId,
          numeroLote: data.numeroLote,
          dataValidade: data.dataValidade,
          quantidadeInicial: 0,
          precoCompra: data.precoCompra || produtoFornecedor.precoCompra,
          stockBalance: {
            create: {
              quantidadeTotal: 0,
              quantidadeDisponivel: 0,
            },
          },
        },
      });

      return {
        message: "Lote criado com sucesso",
        loteId: lote.id.toString(),
        lote,
      };
    });
  }
}
