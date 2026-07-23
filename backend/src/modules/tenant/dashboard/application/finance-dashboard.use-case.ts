import { getPrisma } from "../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  daysAgo,
  endOfDay,
  endOfMonth,
  FATURA_VENDA_WHERE,
  round2,
  startOfDay,
  startOfMonth,
  toIsoDate,
  toNumber,
} from "./dashboard-date.util";
import {
  resolveDashboardPeriod,
  serializePeriodo,
} from "./dashboard-period.util";
import {
  buildPagedTableResult,
  normalizeTablePagination,
} from "./dashboard-pagination.util";
import { ListContasPagarUseCase } from "./list-contas-pagar.use-case";
import { ListContasReceberUseCase } from "./list-contas-receber.use-case";
import { ListFinancialMovementsUseCase } from "./list-financial-movements.use-case";

type PeriodParams = {
  days?: number;
  period?: string;
  from?: string;
  to?: string;
};
type FinanceTableParams = PeriodParams & {
  table:
    | "ultimosPagamentos"
    | "ultimasReceitas"
    | "ultimasDespesas"
    | "contasVencidas"
    | "fluxoCaixa"
    | "contasReceber"
    | "contasPagar";
  page?: number;
  pageSize?: number;
  search?: string;
  clienteId?: string;
  estado?: string;
  metodoPagamento?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

export class FinanceDashboardUseCase {
  async execute(params: PeriodParams = {}) {
    const prisma = getPrisma() as any;
    const resolved = resolveDashboardPeriod(params);
    const days = resolved.days;
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const chartFrom = resolved.from;
    const todayEnd = resolved.to;

    const caixaMovimentoPeriod = {
      deletedAt: null,
      createdAt: { gte: monthStart, lte: monthEnd },
    };

    const [
      receitasMes,
      saidasMes,
      suprimentosMes,
      sangriasMes,
      contasReceberAgg,
      contasPagarAgg,
      recebimentosPendentes,
      pagamentosPendentes,
      saldoCaixaAgg,
      movimentosChart,
      movimentosMensais,
      pagamentosRecentes,
      receitasRecentes,
      despesasRecentes,
      contasVencidas,
      metodosPagamento,
    ] = await prisma.$transaction([
      prisma.financialMovement.aggregate({
        where: {
          deletedAt: null,
          type: { in: ["SALE", "DEBT_PAYMENT"] },
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),
      prisma.caixaMovimento.aggregate({
        where: { ...caixaMovimentoPeriod, tipo: "SAIDA" },
        _sum: { valor: true },
      }),
      prisma.caixaMovimento.aggregate({
        where: { ...caixaMovimentoPeriod, tipo: "SUPRIMENTO" },
        _sum: { valor: true },
      }),
      prisma.caixaMovimento.aggregate({
        where: { ...caixaMovimentoPeriod, tipo: "SANGRIA" },
        _sum: { valor: true },
      }),
      prisma.contaReceber.aggregate({
        where: { status: { in: ["ABERTA", "PARCIAL"] } },
        _sum: { saldo: true },
      }),
      prisma.contaPagar.aggregate({
        where: { status: { in: ["ABERTA", "PARCIAL"] } },
        _sum: { saldo: true },
      }),
      prisma.contaReceber.count({
        where: { status: { in: ["ABERTA", "PARCIAL"] } },
      }),
      prisma.contaPagar.count({
        where: { status: { in: ["ABERTA", "PARCIAL"] } },
      }),
      prisma.cashBalance.aggregate({ _sum: { saldoTotal: true } }),
      prisma.financialMovement.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: chartFrom, lte: todayEnd },
        },
        select: { createdAt: true, amount: true, type: true },
      }),
      prisma.financialMovement.findMany({
        where: {
          deletedAt: null,
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
            lte: monthEnd,
          },
        },
        select: { createdAt: true, amount: true, type: true },
      }),
      prisma.pagamento.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          valor: true,
          metodo: true,
          status: true,
          createdAt: true,
          fatura: { select: { numero: true } },
        },
      }),
      prisma.financialMovement.findMany({
        where: {
          deletedAt: null,
          type: { in: ["SALE", "DEBT_PAYMENT"] },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          amount: true,
          type: true,
          reference: true,
          createdAt: true,
        },
      }),
      prisma.financialMovement.findMany({
        where: {
          deletedAt: null,
          type: { in: ["EXPENSE", "PURCHASE", "REFUND"] },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          amount: true,
          type: true,
          reference: true,
          createdAt: true,
        },
      }),
      prisma.contaReceber.findMany({
        where: {
          status: { in: ["ABERTA", "PARCIAL"] },
          vencimento: { lt: now },
        },
        orderBy: { vencimento: "asc" },
        take: 10,
        select: {
          id: true,
          valor: true,
          saldo: true,
          vencimento: true,
          cliente: { select: { nome: true } },
        },
      }),
      prisma.fatura.groupBy({
        by: ["tipoPagamento"],
        where: {
          ...FATURA_VENDA_WHERE,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
    ]);

    const receita = round2(toNumber(receitasMes._sum.amount));
    const saidas = round2(toNumber(saidasMes._sum.valor));
    const suprimentos = round2(toNumber(suprimentosMes._sum.valor));
    const sangrias = round2(toNumber(sangriasMes._sum.valor));
    const despesas = saidas;
    const lucro = round2(receita - saidas - sangrias);
    const saldoAtual = round2(toNumber(saldoCaixaAgg._sum.saldoTotal));

    return {
      kpis: {
        receita,
        despesas,
        saidas,
        suprimentos,
        sangrias,
        lucro,
        fluxoCaixa: lucro,
        saldoAtual,
        contasReceber: round2(toNumber(contasReceberAgg._sum.saldo)),
        contasPagar: round2(toNumber(contasPagarAgg._sum.saldo)),
        recebimentosPendentes,
        pagamentosPendentes,
      },
      charts: {
        fluxoDiario: buildFlowSeries(movimentosChart, chartFrom, days),
        fluxoMensal: buildMonthlyFlow(movimentosMensais, 6),
        receitasDespesas: buildFlowSeries(movimentosChart, chartFrom, days),
        evolucaoFinanceira: buildMonthlyFlow(movimentosMensais, 6),
        metodosPagamento: metodosPagamento.map((row: any) => ({
          metodo: row.tipoPagamento,
          total: round2(toNumber(row._sum.total)),
          quantidade: row._count._all ?? 0,
        })),
      },
      tables: {
        ultimosPagamentos: pagamentosRecentes.map((row: any) => ({
          id: row.id.toString(),
          valor: round2(toNumber(row.valor)),
          metodo: row.metodo,
          status: row.status,
          faturaNumero: row.fatura?.numero ?? "—",
          createdAt: row.createdAt.toISOString(),
        })),
        ultimasReceitas: receitasRecentes.map((row: any) => ({
          id: row.id.toString(),
          valor: round2(toNumber(row.amount)),
          tipo: row.type,
          referencia: row.reference ?? "—",
          createdAt: row.createdAt.toISOString(),
        })),
        ultimasDespesas: despesasRecentes.map((row: any) => ({
          id: row.id.toString(),
          valor: round2(toNumber(row.amount)),
          tipo: row.type,
          referencia: row.reference ?? "—",
          createdAt: row.createdAt.toISOString(),
        })),
        contasVencidas: contasVencidas.map((row: any) => ({
          id: row.id.toString(),
          clienteNome: row.cliente?.nome ?? "—",
          valor: round2(toNumber(row.valor)),
          saldo: round2(toNumber(row.saldo)),
          vencimento: row.vencimento?.toISOString() ?? null,
        })),
      },
      periodo: serializePeriodo(resolved),
    };
  }

  async listTable(params: FinanceTableParams) {
    const prisma = getPrisma() as any;
    const { page, pageSize } = normalizeTablePagination(params);
    const resolved = resolveDashboardPeriod(params);
    const search = params.search?.trim();
    const sortDir = params.sortDir === "asc" ? "asc" : "desc";
    const now = new Date();

    switch (params.table) {
      case "ultimosPagamentos": {
        const where: any = {
          deletedAt: null,
          createdAt: { gte: resolved.from, lte: resolved.to },
        };
        if (params.metodoPagamento) where.metodo = params.metodoPagamento;
        if (params.estado) where.status = params.estado;
        if (search) {
          where.OR = [
            { metodo: { contains: search, mode: "insensitive" } },
            { fatura: { numero: { contains: search, mode: "insensitive" } } },
          ];
        }
        const [totalCount, rows] = await prisma.$transaction([
          prisma.pagamento.count({ where }),
          prisma.pagamento.findMany({
            where,
            orderBy: { createdAt: sortDir },
            skip: (page - 1) * pageSize,
            take: pageSize + 1,
            select: {
              id: true,
              valor: true,
              metodo: true,
              status: true,
              createdAt: true,
              fatura: { select: { numero: true } },
            },
          }),
        ]);
        return buildPagedTableResult({
          table: params.table,
          page,
          pageSize,
          totalCount,
          rows: rows.map((row: any) => ({
            id: row.id.toString(),
            valor: round2(toNumber(row.valor)),
            metodo: row.metodo,
            status: row.status,
            faturaNumero: row.fatura?.numero ?? "—",
            createdAt: row.createdAt.toISOString(),
          })),
        });
      }
      case "ultimasReceitas": {
        const where: any = {
          deletedAt: null,
          type: { in: ["SALE", "DEBT_PAYMENT"] },
          createdAt: { gte: resolved.from, lte: resolved.to },
        };
        if (search) {
          where.OR = [
            { reference: { contains: search, mode: "insensitive" } },
            { type: { contains: search, mode: "insensitive" } },
          ];
        }
        const [totalCount, rows] = await prisma.$transaction([
          prisma.financialMovement.count({ where }),
          prisma.financialMovement.findMany({
            where,
            orderBy: { createdAt: sortDir },
            skip: (page - 1) * pageSize,
            take: pageSize + 1,
            select: {
              id: true,
              amount: true,
              type: true,
              reference: true,
              createdAt: true,
            },
          }),
        ]);
        return buildPagedTableResult({
          table: params.table,
          page,
          pageSize,
          totalCount,
          rows: rows.map((row: any) => ({
            id: row.id.toString(),
            valor: round2(toNumber(row.amount)),
            tipo: row.type,
            referencia: row.reference ?? "—",
            createdAt: row.createdAt.toISOString(),
          })),
        });
      }
      case "ultimasDespesas": {
        const where: any = {
          deletedAt: null,
          type: { in: ["EXPENSE", "PURCHASE", "REFUND"] },
          createdAt: { gte: resolved.from, lte: resolved.to },
        };
        if (search) {
          where.OR = [
            { reference: { contains: search, mode: "insensitive" } },
            { type: { contains: search, mode: "insensitive" } },
          ];
        }
        const [totalCount, rows] = await prisma.$transaction([
          prisma.financialMovement.count({ where }),
          prisma.financialMovement.findMany({
            where,
            orderBy: { createdAt: sortDir },
            skip: (page - 1) * pageSize,
            take: pageSize + 1,
            select: {
              id: true,
              amount: true,
              type: true,
              reference: true,
              createdAt: true,
            },
          }),
        ]);
        return buildPagedTableResult({
          table: params.table,
          page,
          pageSize,
          totalCount,
          rows: rows.map((row: any) => ({
            id: row.id.toString(),
            valor: round2(toNumber(row.amount)),
            tipo: row.type,
            referencia: row.reference ?? "—",
            createdAt: row.createdAt.toISOString(),
          })),
        });
      }
      case "contasVencidas": {
        const where: any = {
          status: { in: ["ABERTA", "PARCIAL"] },
          vencimento: { gte: resolved.from, lt: now },
        };
        if (params.clienteId) where.clienteId = BigInt(params.clienteId);
        if (search) {
          where.cliente = { nome: { contains: search, mode: "insensitive" } };
        }
        const [totalCount, rows] = await prisma.$transaction([
          prisma.contaReceber.count({ where }),
          prisma.contaReceber.findMany({
            where,
            orderBy: { vencimento: sortDir },
            skip: (page - 1) * pageSize,
            take: pageSize + 1,
            select: {
              id: true,
              valor: true,
              saldo: true,
              vencimento: true,
              cliente: { select: { nome: true } },
            },
          }),
        ]);
        return buildPagedTableResult({
          table: params.table,
          page,
          pageSize,
          totalCount,
          rows: rows.map((row: any) => ({
            id: row.id.toString(),
            clienteNome: row.cliente?.nome ?? "—",
            valor: round2(toNumber(row.valor)),
            saldo: round2(toNumber(row.saldo)),
            vencimento: row.vencimento?.toISOString() ?? null,
          })),
        });
      }
      case "fluxoCaixa": {
        const listUseCase = new ListFinancialMovementsUseCase();
        const result = await listUseCase.execute({
          ...params,
          search,
          page,
          pageSize,
          sortDir,
        });
        return {
          table: params.table,
          items: result.items,
          page: result.page,
          pageSize: result.pageSize,
          hasMore: result.hasMore,
          hasPrevious: result.hasPrevious,
          totalCount: result.totalCount,
          totalPages: result.totalPages,
        };
      }
      case "contasReceber": {
        const listUseCase = new ListContasReceberUseCase();
        const result = await listUseCase.execute({
          status: params.estado,
          clienteId: params.clienteId,
          search,
          page,
          pageSize,
          sortDir,
        });
        return {
          table: params.table,
          items: result.items,
          page: result.page,
          pageSize: result.pageSize,
          hasMore: result.hasMore,
          hasPrevious: result.hasPrevious,
          totalCount: result.totalCount,
          totalPages: result.totalPages,
        };
      }
      case "contasPagar": {
        const listUseCase = new ListContasPagarUseCase();
        const result = await listUseCase.execute({
          status: params.estado,
          fornecedorId: params.fornecedorId,
          search,
          page,
          pageSize,
          sortDir,
        });
        return {
          table: params.table,
          items: result.items,
          page: result.page,
          pageSize: result.pageSize,
          hasMore: result.hasMore,
          hasPrevious: result.hasPrevious,
          totalCount: result.totalCount,
          totalPages: result.totalPages,
        };
      }
    }
  }
}

function buildFlowSeries(
  rows: Array<{ createdAt: Date; amount: unknown; type: string }>,
  from: Date,
  days: number,
) {
  const buckets = new Map<string, { receitas: number; despesas: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    buckets.set(toIsoDate(d), { receitas: 0, despesas: 0 });
  }
  for (const row of rows) {
    const key = toIsoDate(new Date(row.createdAt));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const amount = toNumber(row.amount);
    if (row.type === "EXPENSE" || row.type === "PURCHASE" || row.type === "REFUND") {
      bucket.despesas += amount;
    } else {
      bucket.receitas += amount;
    }
  }
  return [...buckets.entries()].map(([data, values]) => ({
    data,
    receitas: round2(values.receitas),
    despesas: round2(values.despesas),
    saldo: round2(values.receitas - values.despesas),
  }));
}

function buildMonthlyFlow(
  rows: Array<{ createdAt: Date; amount: unknown; type: string }>,
  months: number,
) {
  const now = new Date();
  const buckets = new Map<string, { receitas: number; despesas: number }>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { receitas: 0, despesas: 0 });
  }
  for (const row of rows) {
    const d = new Date(row.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const amount = toNumber(row.amount);
    if (row.type === "EXPENSE" || row.type === "PURCHASE" || row.type === "REFUND") {
      bucket.despesas += amount;
    } else {
      bucket.receitas += amount;
    }
  }
  return [...buckets.entries()].map(([mes, values]) => ({
    mes,
    receitas: round2(values.receitas),
    despesas: round2(values.despesas),
    saldo: round2(values.receitas - values.despesas),
  }));
}
