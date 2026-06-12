import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";
import type { UpdateRequisitionItemDTO } from "../../dto/requisitions.dto";
import { getQuantidadeDisponivel } from "../../../domain/produto-stock.service";

function requiresStockValidation(requisicao: {
  tipo?: string | null;
}): boolean {
  return requisicao.tipo === "SAIDA";
}

export class UpdateRequisitionItemUseCase {
  async execute(
    requisicaoId: string,
    itemId: string,
    input: UpdateRequisitionItemDTO,
  ) {
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
          "So e possivel editar itens de requisicoes pendentes",
        );
      }

      const item = await tx.requisicaoItem.findFirst({
        where: {
          id: BigInt(itemId),
          requisicaoId: requisicao.id,
        },
      });

      if (!item) {
        throw new NotFoundApiError(
          `Item ${itemId} nao encontrado na requisicao ${requisicaoId}`,
        );
      }

      if (requiresStockValidation(requisicao)) {
        const quantidadeDisponivel =
          item.loteId != null
            ? Number(
                (
                  await tx.lote.findUnique({
                    where: { id: item.loteId },
                    select: { quantidadeAtual: true },
                  })
                )?.quantidadeAtual ?? 0,
              )
            : await getQuantidadeDisponivel(tx, item.produtoId);

        if (Number(input.quantidadeSolicitada) > quantidadeDisponivel) {
          throw new ValidationApiError(
            "Stock insuficiente para o item selecionado",
          );
        }
      }

      await tx.requisicaoItem.update({
        where: { id: item.id },
        data: { quantidadeSolicitada: input.quantidadeSolicitada },
      });

      const { GetRequisitionDetailUseCase } = await import(
        "./get-requisition-detail.use-case"
      );
      return new GetRequisitionDetailUseCase().execute(requisicaoId);
    });
  }
}

export type UpdateTransferItemDTO = UpdateRequisitionItemDTO;
export const UpdateTransferItemUseCase = UpdateRequisitionItemUseCase;
