import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";
import { getQuantidadeDisponivel } from "../../../domain/produto-stock.service";

export interface AddRequisitionItemInput {
  produtoId: string;
  loteId?: string;
  quantidadeSolicitada: number;
}

function requiresStockValidation(requisicao: {
  tipo?: string | null;
}): boolean {
  return requisicao.tipo === "SAIDA";
}

export class AddRequisitionItemUseCase {
  async execute(requisicaoId: string, input: AddRequisitionItemInput) {
    const prisma = getPrisma() as any;

    return prisma.$transaction(async (tx: any) => {
      const requisicao = await tx.requisicao.findUnique({
        where: { id: BigInt(requisicaoId) },
      });

      if (!requisicao) {
        throw new NotFoundApiError(`Requisicao ${requisicaoId} nao encontrada`);
      }

      if (requisicao.status !== "PENDENTE") {
        throw new ValidationApiError(
          "So e possivel adicionar itens a requisicoes pendentes",
        );
      }

      const produtoId = BigInt(input.produtoId);
      const produto = await tx.produto.findUnique({
        where: { id: produtoId },
        select: { id: true, nome: true },
      });

      if (!produto) {
        throw new NotFoundApiError(`Produto ${input.produtoId} nao encontrado`);
      }

      let loteId: bigint | null = null;
      if (input.loteId) {
        loteId = BigInt(input.loteId);
        const lote = await tx.lote.findUnique({
          where: { id: loteId },
          select: { id: true, produtoId: true },
        });

        if (!lote) {
          throw new NotFoundApiError(`Lote ${input.loteId} nao encontrado`);
        }

        if (lote.produtoId !== produtoId) {
          throw new ValidationApiError(
            "O lote informado nao pertence ao produto selecionado",
          );
        }
      }

      const existingItem = await tx.requisicaoItem.findFirst({
        where: {
          requisicaoId: requisicao.id,
          produtoId,
          loteId,
        },
      });

      const quantidadeSolicitada =
        Number(existingItem?.quantidadeSolicitada ?? 0) +
        Number(input.quantidadeSolicitada);

      if (requiresStockValidation(requisicao)) {
        const quantidadeDisponivel =
          loteId != null
            ? Number(
                (
                  await tx.lote.findUnique({
                    where: { id: loteId },
                    select: { quantidadeAtual: true },
                  })
                )?.quantidadeAtual ?? 0,
              )
            : await getQuantidadeDisponivel(tx, produtoId);

        if (quantidadeSolicitada > quantidadeDisponivel) {
          throw new ValidationApiError(
            `Stock insuficiente para o produto ${produto.nome}`,
          );
        }
      }

      const item = existingItem
        ? await tx.requisicaoItem.update({
            where: { id: existingItem.id },
            data: {
              quantidadeSolicitada: { increment: input.quantidadeSolicitada },
            },
          })
        : await tx.requisicaoItem.create({
            data: {
              requisicaoId: requisicao.id,
              produtoId,
              loteId,
              quantidadeSolicitada: input.quantidadeSolicitada,
            },
          });

      return {
        message: "Item adicionado a requisicao com sucesso",
        requisicaoId: requisicao.id.toString(),
        itemId: item.id.toString(),
        quantidadeSolicitada: Number(item.quantidadeSolicitada),
      };
    });
  }
}

export type AddTransferItemInput = AddRequisitionItemInput;
export const AddTransferItemUseCase = AddRequisitionItemUseCase;
