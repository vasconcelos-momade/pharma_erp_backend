import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";

export interface AddTransferItemInput {
  produtoId: string;
  loteId?: string;
  quantidade: number;
}

export class AddTransferItemUseCase {
  async execute(transferenciaId: string, input: AddTransferItemInput) {
    const prisma = getPrisma() as any;

    return prisma.$transaction(async (tx: any) => {
      const transferencia = await tx.transferencia.findUnique({
        where: { id: BigInt(transferenciaId) },
      });

      if (!transferencia) {
        throw new NotFoundApiError(
          `Transferência ${transferenciaId} não encontrada`,
        );
      }

      if (transferencia.status !== "RASCUNHO") {
        throw new ValidationApiError(
          "Só é possível adicionar itens a transferências em rascunho",
        );
      }

      const produtoId = BigInt(input.produtoId);
      const produto = await tx.produto.findUnique({
        where: { id: produtoId },
        select: { id: true, nome: true },
      });

      if (!produto) {
        throw new NotFoundApiError(
          `Produto ${input.produtoId} não encontrado`,
        );
      }

      let loteId: bigint | null = null;
      if (input.loteId) {
        loteId = BigInt(input.loteId);
        const lote = await tx.lote.findUnique({
          where: { id: loteId },
          select: { id: true, produtoId: true },
        });

        if (!lote) {
          throw new NotFoundApiError(`Lote ${input.loteId} não encontrado`);
        }

        if (lote.produtoId !== produtoId) {
          throw new ValidationApiError(
            "O lote informado não pertence ao produto selecionado",
          );
        }
      }

      const existingItem = await tx.transferenciaItem.findFirst({
        where: {
          transferenciaId: transferencia.id,
          produtoId,
          loteId,
        },
      });

      const item = existingItem
        ? await tx.transferenciaItem.update({
            where: { id: existingItem.id },
            data: {
              quantidade: { increment: input.quantidade },
            },
          })
        : await tx.transferenciaItem.create({
            data: {
              transferenciaId: transferencia.id,
              produtoId,
              loteId,
              quantidade: input.quantidade,
            },
          });

      return {
        message: "Item adicionado à transferência com sucesso",
        transferenciaId: transferencia.id.toString(),
        itemId: item.id.toString(),
        quantidade: Number(item.quantidade),
      };
    });
  }
}
