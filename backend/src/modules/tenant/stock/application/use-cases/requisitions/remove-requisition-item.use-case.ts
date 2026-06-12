import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";

export class RemoveRequisitionItemUseCase {
  async execute(requisicaoId: string, itemId: string) {
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
          "So e possivel remover itens de requisicoes pendentes",
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

      await tx.requisicaoItem.delete({
        where: { id: item.id },
      });

      const { GetRequisitionDetailUseCase } = await import(
        "./get-requisition-detail.use-case"
      );
      return new GetRequisitionDetailUseCase().execute(requisicaoId);
    });
  }
}

export const RemoveTransferItemUseCase = RemoveRequisitionItemUseCase;
