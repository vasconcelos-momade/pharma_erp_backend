import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";
import type { UpdateTransferItemDTO } from "../../dto/transfers.dto";

export class UpdateTransferItemUseCase {
  async execute(
    transferenciaId: string,
    itemId: string,
    input: UpdateTransferItemDTO,
  ) {
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
          "Só é possível editar itens de transferências em rascunho",
        );
      }

      const item = await tx.transferenciaItem.findFirst({
        where: {
          id: BigInt(itemId),
          transferenciaId: transferencia.id,
        },
      });

      if (!item) {
        throw new NotFoundApiError(
          `Item ${itemId} não encontrado na transferência ${transferenciaId}`,
        );
      }

      await tx.transferenciaItem.update({
        where: { id: item.id },
        data: { quantidade: input.quantidade },
      });

      const { GetTransferDetailUseCase } = await import("./get-transfer-detail.use-case");
      return new GetTransferDetailUseCase().execute(transferenciaId);
    });
  }
}
