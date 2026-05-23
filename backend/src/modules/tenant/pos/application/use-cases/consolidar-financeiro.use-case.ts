import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { Prisma } from "../../../../../infrastructure/prisma/tenant/generated/tenant";

export interface ConsolidarFinanceiroDTO {
  dia?: number;
  mes: number;
  ano: number;
  periodo?: "DIARIO" | "MENSAL";
}

export class ConsolidarFinanceiroUseCase {
  async execute(data: ConsolidarFinanceiroDTO, externalTx?: Prisma.TransactionClient) {
    const prisma = getPrisma();
    const tx = externalTx || prisma;
    
    const periodo = data.periodo || (data.dia ? "DIARIO" : "MENSAL");
    
    let startDate: Date;
    let endDate: Date;

    if (periodo === "DIARIO" && data.dia) {
      startDate = new Date(data.ano, data.mes - 1, data.dia, 0, 0, 0);
      endDate = new Date(data.ano, data.mes - 1, data.dia, 23, 59, 59);
    } else {
      startDate = new Date(data.ano, data.mes - 1, 1, 0, 0, 0);
      endDate = new Date(data.ano, data.mes, 0, 23, 59, 59);
    }

    // 1. Calcular Receita Total (Faturas Pagas ou Parciais, não anuladas)
    const faturas = await tx.fatura.aggregate({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        estado: { in: ["PAGA", "PARCIAL", "EMITIDA"] },
        deletedAt: null
      },
      _sum: {
        total: true
      }
    });

    const totalVendas = Number(faturas._sum.total || 0);

    // 2. Calcular Custo das Mercadorias Vendidas (CMV)
    const rawCusto: any[] = await tx.$queryRaw`
      SELECT SUM(fi.custoUnitario * fi.quantidade) as totalCusto 
      FROM fatura_itens fi
      JOIN faturas f ON fi.faturaId = f.id
      WHERE f.createdAt BETWEEN ${startDate} AND ${endDate}
      AND f.estado IN ('PAGA', 'PARCIAL', 'EMITIDA')
      AND f.deletedAt IS NULL
    `;
    
    const totalCustos = Number(rawCusto[0]?.totalCusto || 0);

    // 3. Calcular Despesas Totais
    const movements = await tx.financialMovement.groupBy({
      by: ['type'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
        deletedAt: null
      },
      _sum: {
        amount: true
      }
    });

    let totalDespesas = 0;
    movements.forEach(m => {
      if (m.type === 'EXPENSE' || m.type === 'PURCHASE') {
        totalDespesas += Number(m._sum.amount || 0);
      }
    });

    // 4. Calcular Lucros e Margens
    const lucroBruto = totalVendas - totalCustos;
    const lucroLiquido = totalVendas - totalCustos - totalDespesas;
    const margemLucro = totalVendas > 0 ? (lucroLiquido / totalVendas) * 100 : 0;

    // 5. Atualizar ou Criar o Resumo (Upsert)
    const summary = await tx.financialSummary.upsert({
      where: {
        periodo_ano_mes_dia: {
          periodo: periodo,
          ano: data.ano,
          mes: data.mes,
          dia: data.dia ?? 0
        }
      },
      update: {
        totalVendas,
        totalCustos,
        totalDespesas,
        lucroBruto,
        lucroLiquido,
        margemLucro,
      },
      create: {
        periodo: periodo,
        ano: data.ano,
        mes: data.mes,
        dia: data.dia ?? 0,
        totalVendas,
        totalCustos,
        totalDespesas,
        lucroBruto,
        lucroLiquido,
        margemLucro,
      }
    });

    return {
      success: true,
      periodo,
      summary
    };
  }
}
