import { randomUUID } from "node:crypto";
import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ComplianceAuditService } from "../../../../../shared/services/compliance-audit.service";
import type {
  CashflowOperationBody,
  CashflowOrigem,
} from "../dto/cashflow.dto";

type CashflowOperationKind = "SAIDA" | "SUPRIMENTO" | "SANGRIA" | "ESTORNO";

type RegisterCashflowOperationInput = CashflowOperationBody & {
  userId: string;
  kind: CashflowOperationKind;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function resolveFinancialMovementType(
  kind: CashflowOperationKind,
  origem: CashflowOrigem,
): "EXPENSE" | "PURCHASE" | "ADJUSTMENT" | "REFUND" {
  if (kind === "SAIDA" && origem === "COMPRA") return "PURCHASE";
  if (kind === "SAIDA" || kind === "SANGRIA") return "EXPENSE";
  if (kind === "ESTORNO") return "REFUND";
  return "ADJUSTMENT";
}

function resolveDirection(kind: CashflowOperationKind): "increment" | "decrement" {
  return kind === "SUPRIMENTO" || kind === "ESTORNO" ? "increment" : "decrement";
}

export class RegisterCashflowOperationUseCase {
  async execute(input: RegisterCashflowOperationInput) {
    const prisma = getPrisma();
    const valor = round2(Number(input.valor));

    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error("Valor inválido");
    }

    const sessao = await prisma.caixaSessao.findFirst({
      where: {
        userId: BigInt(input.userId),
        status: "ABERTA",
        deletedAt: null,
      },
      orderBy: { openedAt: "desc" },
    });

    if (!sessao) {
      throw new Error(
        "Não existe sessão de caixa aberta. Abra o caixa no POS antes de registar movimentos.",
      );
    }

    const direction = resolveDirection(input.kind);
    const idempotencyKey =
      input.idempotencyKey?.trim() ||
      `CASHFLOW-${input.kind}-${sessao.caixaId}-${Date.now()}-${randomUUID()}`;

    return prisma.$transaction(async (tx) => {
      const caixas: Array<{ id: bigint; saldoAtual: unknown; saldo_atual?: unknown }> =
        await tx.$queryRaw`SELECT * FROM caixas WHERE id = ${sessao.caixaId} FOR UPDATE`;
      const caixa = caixas[0];

      if (!caixa) {
        throw new Error("Caixa não encontrado");
      }

      const saldoAnterior = round2(
        Number(caixa.saldoAtual ?? caixa.saldo_atual ?? 0),
      );
      const saldoFinal =
        direction === "increment"
          ? round2(saldoAnterior + valor)
          : round2(saldoAnterior - valor);

      if (direction === "decrement" && saldoFinal < 0) {
        throw new Error("Saldo insuficiente para concluir a operação");
      }

      const descricao =
        input.descricao?.trim() ||
        `${input.kind} (${input.origem})`;

      const movimento = await tx.caixaMovimento.create({
        data: {
          caixaId: sessao.caixaId,
          userId: BigInt(input.userId),
          tipo: input.kind,
          origem: input.origem,
          valor,
          saldoAnterior,
          saldoFinal,
          idempotencyKey,
          descricao,
        },
      });

      await tx.caixa.update({
        where: { id: sessao.caixaId },
        data: {
          saldoAtual: saldoFinal,
          version: { increment: 1 },
        },
      });

      const financialType = resolveFinancialMovementType(input.kind, input.origem);
      const financialMovement = await tx.financialMovement.create({
        data: {
          userId: BigInt(input.userId),
          caixaId: sessao.caixaId,
          type: financialType,
          amount: valor,
          reference: descricao,
          idempotencyKey: `FIN-${idempotencyKey}`,
        },
      });

      await tx.cashBalance.upsert({
        where: { caixaId: sessao.caixaId },
        update: {
          saldoTotal:
            direction === "increment"
              ? { increment: valor }
              : { decrement: valor },
          saldoDinheiro:
            direction === "increment"
              ? { increment: valor }
              : { decrement: valor },
        },
        create: {
          caixaId: sessao.caixaId,
          saldoTotal: direction === "increment" ? valor : 0,
          saldoDinheiro: direction === "increment" ? valor : 0,
          saldoDigital: 0,
        },
      });

      const audit = new ComplianceAuditService();
      await audit.createImmutableLog(
        {
          userId: input.userId,
          action: `CASHFLOW_${input.kind}`,
          entity: "CaixaMovimento",
          entityId: movimento.id.toString(),
          after: {
            kind: input.kind,
            origem: input.origem,
            valor,
            saldoAnterior,
            saldoFinal,
          },
        },
        tx,
      );

      return {
        movimentoId: movimento.id.toString(),
        financialMovementId: financialMovement.id.toString(),
        caixaId: sessao.caixaId.toString(),
        kind: input.kind,
        origem: input.origem,
        valor,
        saldoAnterior,
        saldoAtual: saldoFinal,
        descricao,
      };
    });
  }
}
