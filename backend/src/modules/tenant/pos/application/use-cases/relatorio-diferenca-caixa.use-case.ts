import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";

export class RelatorioDiferencaCaixaUseCase {
  async execute(sessaoId: string) {
    const prisma = getPrisma();

    // 1. Buscar Sessão com dados do Caixa e Ledger
    const sessao = await prisma.caixaSessao.findUnique({
      where: { id: BigInt(sessaoId) },
      include: { 
        caixa: true,
        user: true,
        fechadoPor: true
      }
    });

    if (!sessao) throw new Error("Sessão de caixa não encontrada");

    // 2. Buscar todos os movimentos do Ledger (FinancialMovement) durante o período da sessão
    const movimentosLedger = await prisma.financialMovement.findMany({
      where: {
        caixaId: sessao.caixaId,
        createdAt: {
          gte: sessao.openedAt,
          lte: sessao.closedAt || new Date()
        }
      }
    });

    // 3. Buscar todos os movimentos operacionais (CaixaMovimento)
    const movimentosOperacionais = await prisma.caixaMovimento.findMany({
      where: {
        caixaId: sessao.caixaId,
        createdAt: {
          gte: sessao.openedAt,
          lte: sessao.closedAt || new Date()
        }
      }
    });

    // 4. Agrupar por tipo para o relatório
    const totaisPorTipo = movimentosLedger.reduce((acc: any, mov) => {
      const type = mov.type;
      if (!acc[type]) acc[type] = 0;
      acc[type] += Number(mov.amount);
      return acc;
    }, {});

    const totalEntradas = movimentosLedger
      .filter(m => ["SALE", "DEBT_PAYMENT"].includes(m.type))
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const totalSaidas = movimentosLedger
      .filter(m => ["REFUND", "EXPENSE"].includes(m.type))
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const saldoEsperadoLedger = Number(sessao.abertura) + totalEntradas - totalSaidas;

    return {
      sessao: {
        id: sessao.id.toString(),
        operador: sessao.user.name,
        abertura: sessao.openedAt,
        fecho: sessao.closedAt,
        status: sessao.status
      },
      financeiro: {
        valorAbertura: Number(sessao.abertura),
        totalEntradas,
        totalSaidas,
        saldoEsperadoLedger,
        saldoFinalSistema: Number(sessao.sistema),
        valorContado: sessao.contado ? Number(sessao.contado) : null,
        diferenca: sessao.diferenca ? Number(sessao.diferenca) : null
      },
      detalhesLedger: totaisPorTipo,
      auditoria: {
        totalMovimentosLedger: movimentosLedger.length,
        totalMovimentosOperacionais: movimentosOperacionais.length,
        discrepanciaLedgerVsSistema: saldoEsperadoLedger - Number(sessao.sistema)
      }
    };
  }
}
