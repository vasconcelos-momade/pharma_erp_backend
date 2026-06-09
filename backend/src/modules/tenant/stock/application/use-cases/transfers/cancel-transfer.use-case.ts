import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";
import { assertTransferManagerRole } from "../../../domain/transfer-auth.service";

export class CancelTransferUseCase {
  async execute(transferenciaId: string, userId: string) {
    await assertTransferManagerRole(userId);
    const prisma = getPrisma() as any;

    const transferencia = await prisma.transferencia.findUnique({
      where: { id: BigInt(transferenciaId) },
    });

    if (!transferencia) {
      throw new NotFoundApiError(
        `Transferência ${transferenciaId} não encontrada`,
      );
    }

    if (transferencia.status === "CONFIRMADA") {
      throw new ValidationApiError(
        "Não é possível cancelar uma transferência já confirmada",
      );
    }

    if (transferencia.status === "CANCELADA") {
      return {
        message: "Transferência já estava cancelada",
        transferenciaId: transferencia.id.toString(),
        status: transferencia.status,
      };
    }

    const updated = await prisma.transferencia.update({
      where: { id: transferencia.id },
      data: { status: "CANCELADA" },
    });

    return {
      message: "Transferência cancelada com sucesso",
      transferenciaId: updated.id.toString(),
      status: updated.status,
    };
  }
}
