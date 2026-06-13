import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";
import { PermissionService } from "../../../../shared/permission.service";
import { confirmRequisitionStockMovements } from "../../../domain/requisition-confirmation.service";
import { receivePurchaseItemStock } from "../../../domain/purchase-receiving.service";

export class ApproveRequisitionUseCase {
  async execute(requisicaoId: string, userId: string) {
    const prisma = getPrisma() as any;

    const requisicaoPreview = await prisma.requisicao.findUnique({
      where: { id: BigInt(requisicaoId) },
      select: { tipo: true },
    });

    if (!requisicaoPreview) {
      throw new NotFoundApiError(`Requisicao ${requisicaoId} nao encontrada`);
    }

    const permissionService = new PermissionService(prisma);
    await permissionService.assertPermission(
      userId,
      requisicaoPreview.tipo === "COMPRA" ? "COMPRAS" : "REQUISICOES",
      "APPROVE",
    );

    return prisma.$transaction(async (tx: any) => {
      const requisicao = await tx.requisicao.findUnique({
        where: { id: BigInt(requisicaoId) },
        include: {
          itens: {
            orderBy: { id: "asc" },
          },
        },
      });

      if (!requisicao) {
        throw new NotFoundApiError(`Requisicao ${requisicaoId} nao encontrada`);
      }

      if (requisicao.status !== "PENDENTE") {
        throw new ValidationApiError(
          `A requisicao ja esta no status ${requisicao.status}`,
        );
      }

      if (requisicao.itens.length === 0) {
        throw new ValidationApiError(
          "Adicione pelo menos um item antes de aprovar a requisicao",
        );
      }

      await tx.requisicao.update({
        where: { id: requisicao.id },
        data: {
          status: "APROVADA",
          confirmedAt: new Date(),
          confirmedById: BigInt(userId),
        },
      });

      if (requisicao.tipo === "COMPRA") {
        if (!requisicao.fornecedorId) {
          throw new ValidationApiError(
            "Requisicoes do tipo COMPRA exigem fornecedor",
          );
        }

        for (const item of requisicao.itens) {
          await receivePurchaseItemStock(
            tx,
            {
              produtoId: item.produtoId,
              fornecedorId: requisicao.fornecedorId,
              numeroLote: item.numeroLote ?? "",
              dataValidade: item.dataValidade ?? "",
              quantidade: Number(item.quantidadeSolicitada),
              precoCompra: Number(item.precoCompra ?? 0),
              precoVenda:
                item.precoVenda != null ? Number(item.precoVenda) : null,
              userId: BigInt(userId),
            },
            { salePriceMode: "nullish" },
          );
        }
      } else {
        await confirmRequisitionStockMovements(tx, {
          requisicaoId: requisicao.id,
          numeroDocumento: requisicao.numeroDocumento,
          origem: requisicao.origem,
          destino: requisicao.destino,
          tipo: requisicao.tipo,
          userId: BigInt(userId),
          itens: requisicao.itens.map((item: any) => ({
            id: item.id,
            produtoId: item.produtoId,
            loteId: item.loteId,
            quantidadeSolicitada: Number(item.quantidadeSolicitada ?? 0),
          })),
        });
      }

      const approvedRequest = await tx.requisicao.update({
        where: { id: requisicao.id },
        data: {
          status: "CONCLUIDA",
          confirmedAt: new Date(),
          confirmedById: BigInt(userId),
        },
      });

      return {
        message: "Requisicao aprovada e concluida com sucesso",
        requisicaoId: approvedRequest.id.toString(),
        numeroDocumento: approvedRequest.numeroDocumento,
        status: approvedRequest.status,
      };
    });
  }
}

export const ConfirmRequisitionUseCase = ApproveRequisitionUseCase;
export const ConfirmTransferUseCase = ApproveRequisitionUseCase;
