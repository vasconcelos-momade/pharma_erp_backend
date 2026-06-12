import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";
import { normalizeExpiryDate } from "../../../domain/purchase-receiving.service";
import type { AddRequisitionCompraItemDTO } from "../../dto/requisitions.dto";

export class UpdateRequisitionCompraItemUseCase {
  async execute(
    requisicaoId: string,
    itemId: string,
    data: AddRequisitionCompraItemDTO,
  ) {
    const prisma = getPrisma() as any;

    return prisma.$transaction(async (tx: any) => {
      const requisicao = await tx.requisicao.findUnique({
        where: { id: BigInt(requisicaoId) },
      });

      if (!requisicao) {
        throw new NotFoundApiError(`Requisicao ${requisicaoId} nao encontrada`);
      }

      if (requisicao.tipo !== "COMPRA") {
        throw new ValidationApiError(
          "Itens de compra so podem ser editados em requisicoes do tipo COMPRA",
        );
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

      const subtotal = data.quantidadeSolicitada * data.precoCompra;

      await tx.requisicaoItem.update({
        where: { id: item.id },
        data: {
          produtoId: BigInt(data.produtoId),
          quantidadeSolicitada: data.quantidadeSolicitada,
          numeroLote: data.numeroLote,
          dataValidade: normalizeExpiryDate(data.dataValidade),
          precoCompra: data.precoCompra,
          precoVenda: data.precoVenda ?? null,
          subtotal,
        },
      });

      const items = await tx.requisicaoItem.findMany({
        where: { requisicaoId: requisicao.id },
      });
      const total = items.reduce(
        (sum: number, row: any) => sum + Number(row.subtotal ?? 0),
        0,
      );

      await tx.requisicao.update({
        where: { id: requisicao.id },
        data: { total },
      });

      const { GetRequisitionDetailUseCase } = await import(
        "./get-requisition-detail.use-case"
      );
      return new GetRequisitionDetailUseCase().execute(requisicaoId);
    });
  }
}
