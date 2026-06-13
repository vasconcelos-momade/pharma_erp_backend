import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { PermissionService } from "../../../shared/permission.service";
import { ConsolidarFinanceiroUseCase } from "./consolidar-financeiro.use-case";

export interface FecharSessaoDTO {
  sessaoId: string;
  userId: string;
  valorContado: number;
  observacoes?: string;
}

export class FecharSessaoCaixaUseCase {
  async execute(data: FecharSessaoDTO) {
    const prisma = getPrisma();
    const consolidarUC = new ConsolidarFinanceiroUseCase();

    return await prisma.$transaction(async (tx) => {
      const sessao = await tx.caixaSessao.findUnique({
        where: { id: BigInt(data.sessaoId) },
        include: { caixa: true }
      });

      if (!sessao) throw new Error("Sessão não encontrada");
      if (sessao.status === "FECHADA") throw new Error("Esta sessão já está fechada");

      const permissionService = new PermissionService(tx as any);

      if (sessao.userId !== BigInt(data.userId)) {
        await permissionService.assertPermission(
          data.userId,
          "POS",
          "APPROVE",
          "Voce nao tem permissao para fechar a sessao de outro utilizador.",
        );
      }

      const valorSistema = Number(sessao.caixa.saldoAtual);
      const diferenca = data.valorContado - valorSistema;

      const sessaoFechada = await tx.caixaSessao.update({
        where: { id: sessao.id },
        data: {
          status: "FECHADA",
          closedAt: new Date(),
          sistema: valorSistema,
          contado: data.valorContado,
          diferenca: diferenca,
          observacaoFecho: data.observacoes
        }
      });

      // 1. Disparar Consolidação Financeira (Diária e Mensal)
      const agora = new Date();
      
      // Consolidação Diária
      await consolidarUC.execute({
        dia: agora.getDate(),
        mes: agora.getMonth() + 1,
        ano: agora.getFullYear(),
        periodo: "DIARIO"
      }, tx);

      // Consolidação Mensal
      await consolidarUC.execute({
        mes: agora.getMonth() + 1,
        ano: agora.getFullYear(),
        periodo: "MENSAL"
      }, tx);

      // Registrar Evento de Negócio
      await tx.businessEvent.create({
        data: {
          userId: BigInt(data.userId),
          type: "CASH_SESSION_CLOSED",
          entity: "CaixaSessao",
          entityId: sessao.id,
          payload: {
            caixaId: sessao.caixaId.toString(),
            valorSistema,
            valorContado: data.valorContado,
            diferenca
          }
        }
      });

      return {
        success: true,
        valorSistema,
        valorContado: data.valorContado,
        diferenca,
        status: "FECHADA"
      };
    });
  }
}
