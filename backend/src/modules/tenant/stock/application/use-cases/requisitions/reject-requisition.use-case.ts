import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";
import { assertRequisitionManagerRole } from "../../../domain/requisition-auth.service";

export class RejectRequisitionUseCase {
  async execute(requisicaoId: string, userId: string) {
    await assertRequisitionManagerRole(userId);
    const prisma = getPrisma() as any;

    const requisicao = await prisma.requisicao.findUnique({
      where: { id: BigInt(requisicaoId) },
    });

    if (!requisicao) {
      throw new NotFoundApiError(`Requisicao ${requisicaoId} nao encontrada`);
    }

    if (requisicao.status === "REJEITADA") {
      return {
        message: "Requisicao ja estava rejeitada",
        requisicaoId: requisicao.id.toString(),
        status: requisicao.status,
      };
    }

    if (requisicao.status !== "PENDENTE") {
      throw new ValidationApiError(
        `Nao e possivel rejeitar requisicoes no status ${requisicao.status}`,
      );
    }

    const updated = await prisma.requisicao.update({
      where: { id: requisicao.id },
      data: { status: "REJEITADA" },
    });

    return {
      message: "Requisicao rejeitada com sucesso",
      requisicaoId: updated.id.toString(),
      status: updated.status,
    };
  }
}
