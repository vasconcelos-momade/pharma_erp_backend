import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";
import { assertRequisitionManagerRole } from "../../../domain/requisition-auth.service";

export class CancelRequisitionUseCase {
  async execute(requisicaoId: string, userId: string) {
    await assertRequisitionManagerRole(userId);
    const prisma = getPrisma() as any;

    const requisicao = await prisma.requisicao.findUnique({
      where: { id: BigInt(requisicaoId) },
    });

    if (!requisicao) {
      throw new NotFoundApiError(`Requisicao ${requisicaoId} nao encontrada`);
    }

    if (requisicao.status === "CANCELADA") {
      return {
        message: "Requisicao ja estava cancelada",
        requisicaoId: requisicao.id.toString(),
        status: requisicao.status,
      };
    }

    if (requisicao.status !== "PENDENTE") {
      throw new ValidationApiError(
        `Nao e possivel cancelar requisicoes no status ${requisicao.status}`,
      );
    }

    const updated = await prisma.requisicao.update({
      where: { id: requisicao.id },
      data: { status: "CANCELADA" },
    });

    return {
      message: "Requisicao cancelada com sucesso",
      requisicaoId: updated.id.toString(),
      status: updated.status,
    };
  }
}

export const CancelTransferUseCase = CancelRequisitionUseCase;
