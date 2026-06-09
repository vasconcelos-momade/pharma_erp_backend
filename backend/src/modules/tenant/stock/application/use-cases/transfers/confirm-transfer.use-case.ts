import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";
import { assertTransferManagerRole } from "../../../domain/transfer-auth.service";
import { confirmTransferStockMovements } from "../../../domain/transfer-confirmation.service";

export class ConfirmTransferUseCase {
  async execute(transferenciaId: string, userId: string) {
    await assertTransferManagerRole(userId);
    const prisma = getPrisma() as any;

    return prisma.$transaction(async (tx: any) => {
      const transferencia = await tx.transferencia.findUnique({
        where: { id: BigInt(transferenciaId) },
        include: {
          itens: {
            orderBy: { id: "asc" },
          },
        },
      });

      if (!transferencia) {
        throw new NotFoundApiError(
          `Transferência ${transferenciaId} não encontrada`,
        );
      }

      if (transferencia.status !== "RASCUNHO") {
        throw new ValidationApiError(
          `A transferência já está no status ${transferencia.status}`,
        );
      }

      await confirmTransferStockMovements(tx, {
        transferenciaId: transferencia.id,
        numeroDocumento: transferencia.numeroDocumento,
        origem: transferencia.origem,
        destino: transferencia.destino,
        tipo: transferencia.tipo,
        userId: BigInt(userId),
        itens: transferencia.itens.map((item: any) => ({
          id: item.id,
          produtoId: item.produtoId,
          loteId: item.loteId,
          quantidade: Number(item.quantidade),
        })),
      });

      const confirmedTransfer = await tx.transferencia.update({
        where: { id: transferencia.id },
        data: {
          status: "CONFIRMADA",
          confirmedAt: new Date(),
          confirmedById: BigInt(userId),
        },
      });

      return {
        message: "Transferência confirmada com sucesso",
        transferenciaId: confirmedTransfer.id.toString(),
        numeroDocumento: confirmedTransfer.numeroDocumento,
        status: confirmedTransfer.status,
      };
    });
  }
}
