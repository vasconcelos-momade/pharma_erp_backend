import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";
import { ComplianceAuditService } from "../../../../../../shared/services/compliance-audit.service";
import {
  getLoteQuantidadeDisponivel,
  getLoteQuantidadeFromMovements,
  syncLoteStockBalanceCache,
} from "../../../domain/lote-stock.service";
import { assertMovimentacaoSanitariaPermitida } from "../../../domain/lote-sanitario-policy";
import { syncStockBalanceCache } from "../../../domain/produto-stock.service";
import { mapLoteListItem } from "./lote.mapper";

export interface LoteQuarentenaDTO {
  loteId: string;
  quantidade?: number;
  motivo: string;
  userId: string;
  documentoReferencia?: string;
}

async function loadLoteForUpdate(tx: any, loteId: bigint) {
  await tx.$executeRaw`SELECT id FROM lotes WHERE id = ${loteId} FOR UPDATE`;
  const lote = await tx.lote.findFirst({
    where: { id: loteId, deletedAt: null, ativo: true },
    include: {
      produto: { select: { id: true, nomeComercial: true, barcode: true } },
      fornecedor: { select: { id: true, nome: true } },
      stockBalance: { select: { quantidadeTotal: true, quantidadeDisponivel: true } },
    },
  });

  if (!lote) {
    throw new NotFoundApiError(`Lote ${loteId.toString()} não encontrado`);
  }

  return lote;
}

async function sumActiveReservas(tx: any, loteId: bigint): Promise<number> {
  const reservas = await tx.estoqueReserva.findMany({
    where: {
      loteId,
      expiresAt: { gt: new Date() },
    },
    select: { quantidade: true },
  });

  return reservas.reduce(
    (total: number, row: { quantidade: unknown }) =>
      total + Number(row.quantidade ?? 0),
    0,
  );
}

function resolveDisponibilidadeAfterQuarentena(
  quantidadeAtual: number,
  quantidadeQuarentena: number,
  current: string,
): string {
  const disponivel = Math.max(0, quantidadeAtual - quantidadeQuarentena);
  if (disponivel <= 0) {
    return "INDISPONIVEL";
  }
  if (current === "INDISPONIVEL" && disponivel > 0) {
    return "DISPONIVEL";
  }
  return current;
}

export class MoveLoteToQuarentenaUseCase {
  async execute(data: LoteQuarentenaDTO) {
    const prisma = getPrisma() as any;
    if (data.quantidade == null) {
      throw new ValidationApiError("Quantidade é obrigatória para quarentena");
    }
    const quantidade = Number(data.quantidade);

    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw new ValidationApiError("Quantidade inválida para quarentena");
    }

    if (!data.motivo?.trim()) {
      throw new ValidationApiError("Motivo da quarentena é obrigatório");
    }

    return prisma.$transaction(async (tx: any) => {
      const loteId = BigInt(data.loteId);
      const lote = await loadLoteForUpdate(tx, loteId);

      try {
        assertMovimentacaoSanitariaPermitida(lote, "QUARENTENA");
      } catch (error) {
        throw new ValidationApiError(
          error instanceof Error ? error.message : "Quarentena não permitida",
        );
      }

      // Preferir movimentos + sync; cache pode estar desfasado.
      const disponivel = await getLoteQuantidadeDisponivel(tx, lote);
      const reservado = await sumActiveReservas(tx, loteId);
      const disponivelOperacional = Math.max(0, disponivel - reservado);

      if (quantidade > disponivelOperacional) {
        throw new ValidationApiError(
          reservado > 0
            ? "Quantidade indisponível: existem reservas activas para este lote"
            : "Quantidade superior ao stock disponível do lote",
        );
      }

      const quantidadeQuarentena =
        Number(lote.quantidadeQuarentena ?? 0) + quantidade;
      const quantidadeTotal = await getLoteQuantidadeFromMovements(tx, loteId);
      const disponibilidade = resolveDisponibilidadeAfterQuarentena(
        quantidadeTotal,
        quantidadeQuarentena,
        lote.disponibilidade,
      );

      const updated = await tx.lote.update({
        where: { id: loteId },
        data: {
          quantidadeQuarentena,
          disponibilidade,
          version: { increment: 1 },
        },
        include: {
          produto: { select: { id: true, nomeComercial: true, barcode: true } },
          fornecedor: { select: { id: true, nome: true } },
          stockBalance: {
            select: { quantidadeTotal: true, quantidadeDisponivel: true },
          },
        },
      });

      await tx.loteMovimentoSanitario.create({
        data: {
          loteId,
          tipo: "QUARENTENA",
          quantidade,
          motivo: data.motivo.trim(),
          responsavelId: BigInt(data.userId),
          documentoReferencia: data.documentoReferencia?.trim() || null,
        },
      });

      await tx.estoqueMovimento.create({
        data: {
          produtoId: lote.produtoId,
          loteId,
          userId: BigInt(data.userId),
          tipo: "QUARENTENA",
          quantidade,
          estoqueAnterior: quantidadeTotal,
          estoqueFinal: quantidadeTotal,
          origem: "QUARENTENA_SANITARIA",
          observacoes: data.motivo.trim(),
        },
      });

      const synced = await syncLoteStockBalanceCache(tx, {
        id: loteId,
        quantidadeQuarentena,
      });
      await syncStockBalanceCache(tx, lote.produtoId);

      const complianceService = new ComplianceAuditService();
      await complianceService.createImmutableLog(
        {
          userId: data.userId,
          action: "LOTE_QUARENTENA",
          entity: "Lote",
          entityId: data.loteId,
          before: {
            quantidadeQuarentena: Number(lote.quantidadeQuarentena ?? 0),
            disponibilidade: lote.disponibilidade,
          },
          after: {
            quantidadeQuarentena,
            disponibilidade,
            quantidade,
            motivo: data.motivo.trim(),
          },
        },
        tx,
      );

      await tx.businessEvent.create({
        data: {
          userId: BigInt(data.userId),
          type: "LOTE_QUARENTENA",
          entity: "Lote",
          entityId: loteId,
          payload: {
            loteId: data.loteId,
            numeroLote: lote.numeroLote,
            quantidade,
            motivo: data.motivo.trim(),
            documentoReferencia: data.documentoReferencia ?? null,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return {
        message: "Lote movido para quarentena com sucesso",
        lote: mapLoteListItem({
          ...updated,
          quantidadeQuarentena,
          stockBalance: {
            quantidadeTotal: synced.total,
            quantidadeDisponivel: synced.disponivel,
          },
        }),
      };
    });
  }
}

export class RevertLoteQuarentenaUseCase {
  async execute(data: LoteQuarentenaDTO) {
    const prisma = getPrisma() as any;
    const quantidadeSolicitada =
      data.quantidade == null ? null : Number(data.quantidade);

    if (
      quantidadeSolicitada != null &&
      (!Number.isFinite(quantidadeSolicitada) || quantidadeSolicitada <= 0)
    ) {
      throw new ValidationApiError("Quantidade inválida para liberação");
    }

    if (!data.motivo?.trim()) {
      throw new ValidationApiError("Motivo da liberação é obrigatório");
    }

    return prisma.$transaction(async (tx: any) => {
      const loteId = BigInt(data.loteId);
      const lote = await loadLoteForUpdate(tx, loteId);
      const emQuarentena = Number(lote.quantidadeQuarentena ?? 0);

      try {
        assertMovimentacaoSanitariaPermitida(lote, "LIBERACAO");
      } catch (error) {
        throw new ValidationApiError(
          error instanceof Error ? error.message : "Liberação não permitida",
        );
      }

      if (emQuarentena <= 0) {
        throw new ValidationApiError("Este lote não possui quantidade em quarentena");
      }

      const quantidade = quantidadeSolicitada ?? emQuarentena;
      if (quantidade > emQuarentena) {
        throw new ValidationApiError(
          "Quantidade superior à quantidade actualmente em quarentena",
        );
      }

      const quantidadeQuarentena = emQuarentena - quantidade;
      const quantidadeTotal = await getLoteQuantidadeFromMovements(tx, loteId);
      const disponibilidade = resolveDisponibilidadeAfterQuarentena(
        quantidadeTotal,
        quantidadeQuarentena,
        lote.disponibilidade,
      );

      const updated = await tx.lote.update({
        where: { id: loteId },
        data: {
          quantidadeQuarentena,
          disponibilidade,
          version: { increment: 1 },
        },
        include: {
          produto: { select: { id: true, nomeComercial: true, barcode: true } },
          fornecedor: { select: { id: true, nome: true } },
          stockBalance: {
            select: { quantidadeTotal: true, quantidadeDisponivel: true },
          },
        },
      });

      await tx.loteMovimentoSanitario.create({
        data: {
          loteId,
          tipo: "LIBERACAO",
          quantidade,
          motivo: data.motivo.trim(),
          responsavelId: BigInt(data.userId),
          documentoReferencia: data.documentoReferencia?.trim() || null,
        },
      });

      await tx.estoqueMovimento.create({
        data: {
          produtoId: lote.produtoId,
          loteId,
          userId: BigInt(data.userId),
          tipo: "AJUSTE",
          quantidade,
          estoqueAnterior: quantidadeTotal,
          estoqueFinal: quantidadeTotal,
          origem: "LIBERACAO_QUARENTENA",
          observacoes: data.motivo.trim(),
        },
      });

      const synced = await syncLoteStockBalanceCache(tx, {
        id: loteId,
        quantidadeQuarentena,
      });
      await syncStockBalanceCache(tx, lote.produtoId);

      const complianceService = new ComplianceAuditService();
      await complianceService.createImmutableLog(
        {
          userId: data.userId,
          action: "LOTE_LIBERAR_QUARENTENA",
          entity: "Lote",
          entityId: data.loteId,
          before: {
            quantidadeQuarentena: emQuarentena,
            disponibilidade: lote.disponibilidade,
          },
          after: {
            quantidadeQuarentena,
            disponibilidade,
            quantidade,
            motivo: data.motivo.trim(),
          },
        },
        tx,
      );

      await tx.businessEvent.create({
        data: {
          userId: BigInt(data.userId),
          type: "LOTE_LIBERAR_QUARENTENA",
          entity: "Lote",
          entityId: loteId,
          payload: {
            loteId: data.loteId,
            numeroLote: lote.numeroLote,
            quantidade,
            motivo: data.motivo.trim(),
            documentoReferencia: data.documentoReferencia ?? null,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return {
        message: "Quarentena revertida com sucesso",
        lote: mapLoteListItem({
          ...updated,
          quantidadeQuarentena,
          stockBalance: {
            quantidadeTotal: synced.total,
            quantidadeDisponivel: synced.disponivel,
          },
        }),
      };
    });
  }
}
