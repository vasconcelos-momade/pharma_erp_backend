import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";
import { ComplianceAuditService } from "../../../../../../shared/services/compliance-audit.service";
import { mapLoteListItem } from "./lote.mapper";

export interface UpdateLoteDTO {
  loteId: string;
  numeroLote?: string;
  dataValidade?: string;
  dataFabricacao?: string | null;
  userId: string;
}

function parseDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value == null || value.trim() === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationApiError("Data inválida");
  }
  return parsed;
}

export class UpdateLoteUseCase {
  async execute(data: UpdateLoteDTO) {
    const prisma = getPrisma() as any;

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

      const updateData: Record<string, unknown> = {
        version: { increment: 1 },
      };

      if (data.numeroLote !== undefined) {
        const numeroLote = data.numeroLote.trim();
        if (numeroLote.length < 1) {
          throw new ValidationApiError("Número do lote é obrigatório");
        }
        updateData.numeroLote = numeroLote;
      }

      const dataValidade = parseDate(data.dataValidade);
      if (dataValidade !== undefined) {
        if (dataValidade == null) {
          throw new ValidationApiError("Data de validade é obrigatória");
        }
        updateData.dataValidade = dataValidade;
      }

      const dataFabricacao = parseDate(data.dataFabricacao);
      if (dataFabricacao !== undefined) {
        updateData.dataFabricacao = dataFabricacao;
      }

      const updated = await tx.lote.update({
        where: { id: loteId },
        data: updateData,
        include: {
          produto: { select: { id: true, nomeComercial: true, barcode: true } },
          fornecedor: { select: { id: true, nome: true } },
        },
      });

      const complianceService = new ComplianceAuditService();
      await complianceService.createImmutableLog(
        {
          userId: data.userId,
          action: "LOTE_UPDATE",
          entity: "Lote",
          entityId: data.loteId,
          before: {
            numeroLote: lote.numeroLote,
            dataValidade: lote.dataValidade?.toISOString?.() ?? lote.dataValidade,
            dataFabricacao:
              lote.dataFabricacao?.toISOString?.() ?? lote.dataFabricacao,
          },
          after: {
            numeroLote: updated.numeroLote,
            dataValidade:
              updated.dataValidade?.toISOString?.() ?? updated.dataValidade,
            dataFabricacao:
              updated.dataFabricacao?.toISOString?.() ??
              updated.dataFabricacao,
          },
        },
        tx,
      );

      return {
        message: "Lote actualizado com sucesso",
        lote: mapLoteListItem(updated),
      };
    });
  }
}
