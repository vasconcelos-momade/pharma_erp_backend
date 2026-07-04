import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";
import { normalizeExpiryDate } from "../../../domain/purchase-receiving.service";
import type { AddRequisitionCompraItemDTO } from "../../dto/requisitions.dto";

export class AddRequisitionCompraItemUseCase {
  async execute(requisicaoId: string, data: AddRequisitionCompraItemDTO) {
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
          "Itens de compra so podem ser adicionados a requisicoes do tipo COMPRA",
        );
      }

      if (requisicao.status !== "PENDENTE") {
        throw new ValidationApiError(
          "So e possivel adicionar itens a requisicoes pendentes",
        );
      }

      const produtoId = BigInt(data.produtoId);
      const produto = await tx.produto.findUnique({
        where: { id: produtoId },
        select: { id: true, nomeComercial: true },
      });

      if (!produto) {
        throw new NotFoundApiError(`Produto ${data.produtoId} nao encontrado`);
      }

      const subtotal = data.quantidadeSolicitada * data.precoCompra;

      await tx.requisicaoItem.deleteMany({
        where: {
          requisicaoId: requisicao.id,
          produtoId,
          loteId: null,
        },
      });

      await tx.requisicaoItem.create({
        data: {
          requisicaoId: requisicao.id,
          produtoId,
          loteId: null,
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
        (sum: number, item: any) => sum + Number(item.subtotal ?? 0),
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
