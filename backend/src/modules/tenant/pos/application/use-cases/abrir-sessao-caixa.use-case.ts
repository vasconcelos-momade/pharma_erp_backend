import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";

export interface AbrirSessaoDTO {
  caixaId: string;
  userId: string;
  valorAbertura: number;
}

export class AbrirSessaoCaixaUseCase {
  async execute(data: AbrirSessaoDTO) {
    const prisma = getPrisma();

    return await prisma.$transaction(async (tx) => {
      // Validar se o usuário já tem uma sessão aberta
      const sessaoExistente = await tx.caixaSessao.findFirst({
        where: {
          userId: BigInt(data.userId),
          status: "ABERTA"
        }
      });

      if (sessaoExistente) {
        throw new Error("Você já possui uma sessão de caixa aberta. Feche-a antes de abrir uma nova.");
      }

      // Validar se o caixa já está em uso por outro usuário
      const caixaEmUso = await tx.caixaSessao.findFirst({
        where: {
          caixaId: BigInt(data.caixaId),
          status: "ABERTA"
        }
      });

      if (caixaEmUso) {
        throw new Error("Este caixa já está sendo operado por outro usuário.");
      }

      const sessao = await tx.caixaSessao.create({
        data: {
          caixaId: BigInt(data.caixaId),
          userId: BigInt(data.userId),
          abertura: data.valorAbertura,
          sistema: data.valorAbertura, // Inicia com o valor de abertura
          status: "ABERTA"
        }
      });

      // Atualizar saldo do caixa
      await tx.caixa.update({
        where: { id: BigInt(data.caixaId) },
        data: { saldoAtual: data.valorAbertura }
      });

      // Registrar Evento
      await tx.businessEvent.create({
        data: {
          userId: BigInt(data.userId),
          type: "CASH_SESSION_OPENED",
          entity: "CaixaSessao",
          entityId: sessao.id,
          payload: {
            caixaId: data.caixaId,
            abertura: data.valorAbertura
          }
        }
      });

      return {
        success: true,
        sessaoId: sessao.id.toString(),
        status: "ABERTA"
      };
    });
  }
}
