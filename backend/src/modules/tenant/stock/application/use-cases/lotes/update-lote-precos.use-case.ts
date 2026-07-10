import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";
import { ComplianceAuditService } from "../../../../../../shared/services/compliance-audit.service";
import { round2 } from "../../../../dashboard/application/dashboard-date.util";
import { syncStockBalanceCache } from "../../../domain/produto-stock.service";
import { mapLoteListItem } from "./lote.mapper";

export interface UpdateLotePrecosDTO {
  loteId: string;
  precoCompra: number;
  precoVenda?: number | null;
  motivo?: string;
  userId: string;
}

export class UpdateLotePrecosUseCase {
  async execute(data: UpdateLotePrecosDTO) {
    const prisma = getPrisma() as any;
    const precoCompra = round2(Number(data.precoCompra));
    const precoVenda =
      data.precoVenda == null ? null : round2(Number(data.precoVenda));

    if (!Number.isFinite(precoCompra) || precoCompra < 0) {
      throw new ValidationApiError("Preço de compra inválido");
    }
    if (precoVenda != null && (!Number.isFinite(precoVenda) || precoVenda < 0)) {
      throw new ValidationApiError("Preço de venda inválido");
    }

    return prisma.$transaction(async (tx: any) => {
      const loteId = BigInt(data.loteId);
      await tx.$executeRaw`SELECT id FROM lotes WHERE id = ${loteId} FOR UPDATE`;

      const lote = await tx.lote.findFirst({
        where: { id: loteId, deletedAt: null, ativo: true },
        include: {
          produto: { select: { id: true, nomeComercial: true, barcode: true } },
          fornecedor: { select: { id: true, nome: true } },
        },
      });

      if (!lote) {
        throw new NotFoundApiError(`Lote ${data.loteId} não encontrado`);
      }

      const precoCompraAnterior = round2(Number(lote.precoCompra ?? 0));
      const precoVendaAnterior =
        lote.precoVenda == null ? null : round2(Number(lote.precoVenda));

      const updated = await tx.lote.update({
        where: { id: loteId },
        data: {
          precoCompra,
          precoVenda,
          version: { increment: 1 },
        },
        include: {
          produto: { select: { id: true, nomeComercial: true, barcode: true } },
          fornecedor: { select: { id: true, nome: true } },
        },
      });

      if (precoVenda != null && precoVenda !== precoVendaAnterior) {
        await tx.historicoPreco.create({
          data: {
            produtoId: lote.produtoId,
            fornecedorId: lote.fornecedorId,
            precoAnterior: precoVendaAnterior ?? 0,
            precoNovo: precoVenda,
            variacao: round2(precoVenda - (precoVendaAnterior ?? 0)),
          },
        });
      }

      await syncStockBalanceCache(tx, lote.produtoId);

      const complianceService = new ComplianceAuditService();
      await complianceService.createImmutableLog(
        {
          userId: data.userId,
          action: "LOTE_ALTERAR_PRECOS",
          entity: "Lote",
          entityId: data.loteId,
          before: {
            precoCompra: precoCompraAnterior,
            precoVenda: precoVendaAnterior,
          },
          after: {
            precoCompra,
            precoVenda,
            motivo: data.motivo?.trim() || null,
          },
        },
        tx,
      );

      return {
        message: "Preços do lote actualizados com sucesso",
        lote: mapLoteListItem(updated),
      };
    });
  }
}
