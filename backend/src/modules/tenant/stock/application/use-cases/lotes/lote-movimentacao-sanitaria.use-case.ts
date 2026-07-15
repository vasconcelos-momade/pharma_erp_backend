import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";
import { ComplianceAuditService } from "../../../../../../shared/services/compliance-audit.service";
import {
  assertMovimentacaoSanitariaPermitida,
  type MovimentacaoSanitariaTipo,
} from "../../../domain/lote-sanitario-policy";
import {
  getLoteQuantidadeDisponivel,
  getLoteQuantidadeFromMovements,
  syncLoteStockBalanceCache,
} from "../../../domain/lote-stock.service";
import { syncStockBalanceCache } from "../../../domain/produto-stock.service";
import { mapLoteListItem } from "./lote.mapper";
import {
  MoveLoteToQuarentenaUseCase,
  RevertLoteQuarentenaUseCase,
} from "./lote-quarentena.use-case";

export type { MovimentacaoSanitariaTipo };

export interface LoteMovimentacaoSanitariaDTO {
  loteId: string;
  tipo: MovimentacaoSanitariaTipo;
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
      stockBalance: {
        select: { quantidadeTotal: true, quantidadeDisponivel: true },
      },
    },
  });

  if (!lote) {
    throw new NotFoundApiError(`Lote ${loteId.toString()} não encontrado`);
  }

  return lote;
}

async function sumActiveReservas(tx: any, loteId: bigint): Promise<number> {
  const reservas = await tx.estoqueReserva.findMany({
    where: { loteId, expiresAt: { gt: new Date() } },
    select: { quantidade: true },
  });

  return reservas.reduce(
    (total: number, row: { quantidade: unknown }) =>
      total + Number(row.quantidade ?? 0),
    0,
  );
}

function toValidationError(error: unknown): never {
  if (error instanceof Error) {
    throw new ValidationApiError(error.message);
  }
  throw new ValidationApiError("Movimentação sanitária inválida");
}

export class LoteMovimentacaoSanitariaUseCase {
  private moveToQuarentenaUseCase = new MoveLoteToQuarentenaUseCase();
  private revertQuarentenaUseCase = new RevertLoteQuarentenaUseCase();

  async execute(data: LoteMovimentacaoSanitariaDTO) {
    if (!data.motivo?.trim()) {
      throw new ValidationApiError("Motivo é obrigatório");
    }

    const prisma = getPrisma() as any;
    const lotePreview = await prisma.lote.findFirst({
      where: { id: BigInt(data.loteId), deletedAt: null, ativo: true },
      include: {
        stockBalance: {
          select: { quantidadeTotal: true, quantidadeDisponivel: true },
        },
      },
    });
    if (!lotePreview) {
      throw new NotFoundApiError(`Lote ${data.loteId} não encontrado`);
    }
    try {
      assertMovimentacaoSanitariaPermitida(lotePreview, data.tipo);
    } catch (error) {
      toValidationError(error);
    }

    if (data.tipo === "QUARENTENA") {
      if (data.quantidade == null) {
        throw new ValidationApiError("Quantidade é obrigatória");
      }
      return this.moveToQuarentenaUseCase.execute({
        loteId: data.loteId,
        quantidade: data.quantidade,
        motivo: data.motivo,
        userId: data.userId,
        documentoReferencia: data.documentoReferencia,
      });
    }

    if (data.tipo === "LIBERACAO") {
      return this.revertQuarentenaUseCase.execute({
        loteId: data.loteId,
        quantidade: data.quantidade,
        motivo: data.motivo,
        userId: data.userId,
        documentoReferencia: data.documentoReferencia,
      });
    }

    return prisma.$transaction(async (tx: any) => {
      const loteId = BigInt(data.loteId);
      const lote = await loadLoteForUpdate(tx, loteId);
      try {
        assertMovimentacaoSanitariaPermitida(lote, data.tipo);
      } catch (error) {
        toValidationError(error);
      }

      const quantidadeTotal = await getLoteQuantidadeFromMovements(tx, loteId);

      if (data.tipo === "RECALL") {
        if (lote.estadoSanitario === "RECALL") {
          throw new ValidationApiError("Este lote já está em recall");
        }

        const quantidade = Number(data.quantidade ?? 0);
        const updated = await tx.lote.update({
          where: { id: loteId },
          data: {
            estadoSanitario: "RECALL",
            disponibilidade: "BLOQUEADO",
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
            tipo: "RECALL",
            quantidade,
            motivo: data.motivo.trim(),
            responsavelId: BigInt(data.userId),
            documentoReferencia: data.documentoReferencia?.trim() || null,
          },
        });

        await this.audit(tx, data, lote, updated, { quantidade });
        return {
          message: "Recall registado com sucesso",
          lote: mapLoteListItem(updated),
        };
      }

      if (data.quantidade == null) {
        throw new ValidationApiError("Quantidade é obrigatória");
      }

      const quantidade = Number(data.quantidade);
      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        throw new ValidationApiError("Quantidade inválida");
      }

      if (data.tipo === "INCINERACAO") {
        const disponivel = await getLoteQuantidadeDisponivel(tx, lote);
        const quarentena = Math.max(0, Number(lote.quantidadeQuarentena ?? 0));
        const reservado = await sumActiveReservas(tx, loteId);
        const disponivelOperacional = Math.max(0, disponivel - reservado);
        const maxIncineravel = disponivelOperacional + quarentena;

        if (quantidade > maxIncineravel) {
          throw new ValidationApiError(
            reservado > 0
              ? "Quantidade indisponível: existem reservas activas para este lote"
              : "Quantidade superior ao stock disponível do lote",
          );
        }

        const fromDisponivel = Math.min(quantidade, disponivelOperacional);
        const fromQuarentena = Math.min(
          quantidade - fromDisponivel,
          quarentena,
        );
        const quantidadeQuarentena = Math.max(0, quarentena - fromQuarentena);
        const quantidadeIncinerada =
          Number(lote.quantidadeIncinerada ?? 0) + quantidade;
        const estoqueFinal = Math.max(0, quantidadeTotal - quantidade);

        const updated = await tx.lote.update({
          where: { id: loteId },
          data: {
            quantidadeIncinerada,
            quantidadeQuarentena,
            disponibilidade:
              estoqueFinal <= 0 || estoqueFinal <= quantidadeQuarentena
                ? "INDISPONIVEL"
                : lote.disponibilidade,
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

        await tx.estoqueMovimento.create({
          data: {
            produtoId: lote.produtoId,
            loteId,
            userId: BigInt(data.userId),
            tipo: "INCINERACAO",
            quantidade,
            estoqueAnterior: quantidadeTotal,
            estoqueFinal,
            origem: "INCINERACAO_SANITARIA",
            observacoes: data.motivo.trim(),
          },
        });

        await tx.loteMovimentoSanitario.create({
          data: {
            loteId,
            tipo: "INCINERACAO",
            quantidade,
            motivo: data.motivo.trim(),
            responsavelId: BigInt(data.userId),
            documentoReferencia: data.documentoReferencia?.trim() || null,
          },
        });

        await syncLoteStockBalanceCache(tx, updated);
        await syncStockBalanceCache(tx, lote.produtoId);
        await this.audit(tx, data, lote, updated, {
          quantidade,
          quantidadeIncinerada,
          fromDisponivel,
          fromQuarentena,
        });

        return {
          message: "Incineração registada com sucesso",
          lote: mapLoteListItem({
            ...updated,
            stockBalance: {
              quantidadeTotal: estoqueFinal,
              quantidadeDisponivel: Math.max(
                0,
                estoqueFinal - quantidadeQuarentena,
              ),
            },
          }),
        };
      }

      if (data.tipo === "DEVOLUCAO_FORNECEDOR") {
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

        const estoqueFinal = Math.max(0, quantidadeTotal - quantidade);
        const disponibilidade =
          estoqueFinal <= Number(lote.quantidadeQuarentena ?? 0)
            ? "INDISPONIVEL"
            : lote.disponibilidade;

        const updated = await tx.lote.update({
          where: { id: loteId },
          data: {
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

        await tx.estoqueMovimento.create({
          data: {
            produtoId: lote.produtoId,
            loteId,
            userId: BigInt(data.userId),
            tipo: "SAIDA",
            quantidade,
            estoqueAnterior: quantidadeTotal,
            estoqueFinal,
            origem: "DEVOLUCAO_FORNECEDOR",
            observacoes: data.motivo.trim(),
          },
        });

        await tx.loteMovimentoSanitario.create({
          data: {
            loteId,
            tipo: "DEVOLUCAO_FORNECEDOR",
            quantidade,
            motivo: data.motivo.trim(),
            responsavelId: BigInt(data.userId),
            documentoReferencia: data.documentoReferencia?.trim() || null,
          },
        });

        await syncLoteStockBalanceCache(tx, updated);
        await syncStockBalanceCache(tx, lote.produtoId);
        await this.audit(tx, data, lote, updated, { quantidade, estoqueFinal });

        return {
          message: "Devolução ao fornecedor registada com sucesso",
          lote: mapLoteListItem(updated),
        };
      }

      throw new ValidationApiError("Tipo de movimentação sanitária inválido");
    });
  }

  private async audit(
    tx: any,
    data: LoteMovimentacaoSanitariaDTO,
    before: any,
    after: any,
    payload: Record<string, unknown>,
  ) {
    const complianceService = new ComplianceAuditService();
    await complianceService.createImmutableLog(
      {
        userId: data.userId,
        action: `LOTE_MOV_SANITARIA_${data.tipo}`,
        entity: "Lote",
        entityId: data.loteId,
        before: {
          estadoSanitario: before.estadoSanitario,
          disponibilidade: before.disponibilidade,
          quantidadeIncinerada: Number(before.quantidadeIncinerada ?? 0),
          quantidadeQuarentena: Number(before.quantidadeQuarentena ?? 0),
        },
        after: {
          estadoSanitario: after.estadoSanitario,
          disponibilidade: after.disponibilidade,
          quantidadeIncinerada: Number(after.quantidadeIncinerada ?? 0),
          quantidadeQuarentena: Number(after.quantidadeQuarentena ?? 0),
          tipo: data.tipo,
          motivo: data.motivo.trim(),
          documentoReferencia: data.documentoReferencia ?? null,
          ...payload,
        },
      },
      tx,
    );
  }
}
