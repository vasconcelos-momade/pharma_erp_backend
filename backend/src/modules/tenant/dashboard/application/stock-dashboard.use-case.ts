import { LotesDashboardUseCase } from "../../stock/application/use-cases/lotes/search-lotes.use-case";
import { getPrisma } from "../../../../infrastructure/prisma/tenant-prisma.factory";
import { round2, toNumber } from "./dashboard-date.util";
import {
  resolveDashboardPeriod,
  serializePeriodo,
} from "./dashboard-period.util";
import {
  buildPagedTableResult,
  normalizeTablePagination,
} from "./dashboard-pagination.util";

type PeriodParams = {
  days?: number;
  period?: string;
  from?: string;
  to?: string;
};

export class StockDashboardUseCase {
  private lotesDashboard = new LotesDashboardUseCase();

  async execute(params: PeriodParams = {}) {
    const prisma = getPrisma() as any;
    const resolved = resolveDashboardPeriod(params);
    const days = resolved.days;
    const now = new Date();
    const fromDays = resolved.from;

    const [
      lotes,
      stockAgg,
      valorStockRows,
      produtosSemStock,
      produtosCriticosRows,
      inventariosAbertos,
      requisicoesPendentes,
      incineracoesCount,
      ajustesCount,
      movimentosTipo,
      movimentosMensais,
      topMovimentados,
      ultimosMovimentos,
      inventarios,
      requisicoes,
      reservas,
      incineracoes,
    ] = await Promise.all([
      this.lotesDashboard.execute(),
      prisma.stockBalance.aggregate({
        _sum: {
          quantidadeDisponivel: true,
          quantidadeReservada: true,
          quantidadeTotal: true,
        },
      }),
      prisma.lote.findMany({
        where: {
          deletedAt: null,
          ativo: true,
          stockBalance: { quantidadeDisponivel: { gt: 0 } },
        },
        select: {
          quantidadeQuarentena: true,
          stockBalance: { select: { quantidadeDisponivel: true } },
          precoCompra: true,
          produto: {
            select: {
              categoria: { select: { nome: true } },
            },
          },
        },
      }),
      prisma.produto.count({
        where: {
          deletedAt: null,
          ativo: true,
          OR: [
            { stockBalance: { is: { quantidadeDisponivel: { lte: 0 } } } },
            { stockBalance: { is: null } },
          ],
        },
      }),
      prisma.produto.findMany({
        where: { deletedAt: null, ativo: true },
        select: { id: true, nomeComercial: true, estoqueMinimo: true,
          stockBalance: { select: { quantidadeDisponivel: true } },
        },
        take: 200,
      }),
      prisma.inventario.count({ where: { status: "ABERTO" } }),
      prisma.requisicao.count({ where: { status: "PENDENTE" } }),
      prisma.incineracao.count({
        where: { dataIncineracao: { gte: fromDays } },
      }),
      prisma.estoqueMovimento.count({
        where: {
          deletedAt: null,
          tipo: "AJUSTE",
          createdAt: { gte: fromDays },
        },
      }),
      prisma.estoqueMovimento.groupBy({
        by: ["tipo"],
        where: {
          deletedAt: null,
          createdAt: { gte: fromDays },
        },
        _sum: { quantidade: true },
        _count: { _all: true },
      }),
      prisma.estoqueMovimento.findMany({
        where: {
          deletedAt: null,
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
          },
        },
        select: { createdAt: true, tipo: true, quantidade: true },
      }),
      prisma.estoqueMovimento.groupBy({
        by: ["produtoId"],
        where: {
          deletedAt: null,
          createdAt: { gte: fromDays },
        },
        _sum: { quantidade: true },
        _count: { _all: true },
      }),
      prisma.estoqueMovimento.findMany({
        where: { deletedAt: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
        select: {
          id: true,
          tipo: true,
          quantidade: true,
          origem: true,
          createdAt: true,
          produto: { select: { nomeComercial: true } },
          lote: { select: { numeroLote: true } },
        },
      }),
      prisma.inventario.findMany({
        orderBy: { iniciadoEm: "desc" },
        take: 10,
        select: {
          id: true,
          codigo: true,
          status: true,
          iniciadoEm: true,
        },
      }),
      prisma.requisicao.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          numeroDocumento: true,
          status: true,
          tipo: true,
          createdAt: true,
        },
      }),
      prisma.estoqueReserva.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          quantidade: true,
          expiresAt: true,
          createdAt: true,
          produto: { select: { nomeComercial: true } },
          lote: { select: { numeroLote: true } },
        },
      }),
      prisma.incineracao.findMany({
        orderBy: { dataIncineracao: "desc" },
        take: 10,
        select: {
          id: true,
          numeroAuto: true,
          dataIncineracao: true,
        },
      }),
    ]);

    const valorTotalStock = valorStockRows.reduce((sum: number, row: any) => {
      const qty = Math.max(
        0,
        toNumber(row.stockBalance?.quantidadeDisponivel),
      );
      return sum + qty * toNumber(row.precoCompra);
    }, 0);
    const categoriaValorStock = new Map<string, number>();
    for (const row of valorStockRows) {
      const qty = Math.max(
        0,
        toNumber(row.stockBalance?.quantidadeDisponivel),
      );
      const categoria = row.produto?.categoria?.nome ?? "Sem categoria";
      const valor = qty * toNumber(row.precoCompra);
      categoriaValorStock.set(categoria, (categoriaValorStock.get(categoria) ?? 0) + valor);
    }

    const produtosCriticos = produtosCriticosRows
      .map((row: any) => {
        const disponivel = toNumber(row.stockBalance?.quantidadeDisponivel);
        const minimo = toNumber(row.estoqueMinimo);
        return { id: row.id.toString(), nome: row.nomeComercial,
          disponivel: round2(disponivel),
          minimo: round2(minimo),
          critico: disponivel <= 0 || (disponivel > 0 && disponivel <= minimo),
        };
      })
      .filter((row: any) => row.critico)
      .slice(0, 10);

    const produtoIds = [...topMovimentados]
      .sort((a: any, b: any) => (b._count._all ?? 0) - (a._count._all ?? 0))
      .slice(0, 8)
      .map((row: any) => row.produtoId)
      .filter(Boolean);
    const produtoNomes =
      produtoIds.length > 0
        ? await prisma.produto.findMany({
            where: { id: { in: produtoIds } },
            select: { id: true, nomeComercial: true, categoria: { select: { nome: true } } },
          })
        : [];
    const produtoMap = new Map<string, any>(
      produtoNomes.map((p: any) => [p.id.toString(), p]),
    );

    const monthlyBuckets = new Map<string, { entradas: number; saidas: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyBuckets.set(key, { entradas: 0, saidas: 0 });
    }
    for (const row of movimentosMensais) {
      const d = new Date(row.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = monthlyBuckets.get(key);
      if (!bucket) continue;
      const qty = toNumber(row.quantidade);
      if (row.tipo === "ENTRADA") bucket.entradas += qty;
      if (row.tipo === "SAIDA") bucket.saidas += qty;
    }

    return {
      kpis: {
        stockDisponivel: round2(toNumber(stockAgg._sum.quantidadeDisponivel)),
        stockReservado: round2(toNumber(stockAgg._sum.quantidadeReservada)),
        stockTotal: round2(toNumber(stockAgg._sum.quantidadeTotal)),
        valorTotalStock: round2(valorTotalStock),
        produtosCriticos: produtosCriticos.length,
        produtosSemStock,
        lotesAtivos: lotes.totalLotes,
        inventariosAbertos,
        requisicoesPendentes,
        incineracoes: incineracoesCount,
        ajustesStock: ajustesCount,
        alertasOperacionais: lotes.alertasOperacionais,
      },
      charts: {
        entradasSaidas: movimentosTipo.map((row: any) => ({
          tipo: row.tipo,
          quantidade: round2(toNumber(row._sum.quantidade)),
          movimentos: row._count._all ?? 0,
        })),
        movimentacaoMensal: [...monthlyBuckets.entries()].map(([mes, values]) => ({
          mes,
          entradas: round2(values.entradas),
          saidas: round2(values.saidas),
        })),
        produtosMaisMovimentados: [...topMovimentados]
          .sort((a: any, b: any) => (b._count._all ?? 0) - (a._count._all ?? 0))
          .slice(0, 8)
          .map((row: any) => {
          const produto = produtoMap.get(row.produtoId?.toString() ?? "");
          return {
            produtoId: row.produtoId?.toString() ?? null,
            produtoNomeComercial: produto?.nomeComercial ?? "—",
            quantidade: round2(toNumber(row._sum.quantidade)),
            movimentos: row._count._all ?? 0,
          };
        }),
        valorStockPorCategoria: [...categoriaValorStock.entries()].map(
          ([categoria, valor]) => ({
            categoria,
            valor: round2(valor),
          }),
        ),
        composicaoLotes: {
          totalLotes: lotes.totalLotes,
          lotesDisponiveis: lotes.lotesDisponiveis,
          lotesSanitarios: lotes.lotesSanitarios,
          lotesReservados: lotes.lotesReservados,
          lotesExpirados: lotes.lotesExpirados,
        },
      },
      tables: {
        ultimosMovimentos: ultimosMovimentos.map((row: any) => ({
          id: row.id.toString(),
          tipo: row.tipo,
          quantidade: round2(toNumber(row.quantidade)),
          origem: row.origem ?? "—",
          produtoNomeComercial: row.produto?.nomeComercial ?? "—",
          numeroLote: row.lote?.numeroLote ?? "—",
          createdAt: row.createdAt.toISOString(),
        })),
        produtosCriticos,
        inventarios: inventarios.map((row: any) => ({
          id: row.id.toString(),
          codigo: row.codigo,
          status: row.status,
          iniciadoEm: row.iniciadoEm.toISOString(),
        })),
        requisicoes: requisicoes.map((row: any) => ({
          id: row.id.toString(),
          numeroDocumento: row.numeroDocumento,
          status: row.status,
          tipo: row.tipo,
          createdAt: row.createdAt.toISOString(),
        })),
        reservas: reservas.map((row: any) => ({
          id: row.id.toString(),
          produtoNomeComercial: row.produto?.nomeComercial ?? "—",
          numeroLote: row.lote?.numeroLote ?? "—",
          quantidade: round2(toNumber(row.quantidade)),
          expiresAt: row.expiresAt.toISOString(),
          createdAt: row.createdAt.toISOString(),
        })),
        incineracoes: incineracoes.map((row: any) => ({
          id: row.id.toString(),
          numeroAuto: row.numeroAuto,
          dataIncineracao: row.dataIncineracao.toISOString(),
        })),
      },
      lotes,
      periodo: serializePeriodo(resolved),
    };
  }

  async listTable(params: {
    table:
      | "ultimosMovimentos"
      | "inventarios"
      | "requisicoes"
      | "reservas"
      | "incineracoes"
      | "produtosCriticos";
    page?: number;
    pageSize?: number;
    days?: number;
    period?: string;
    from?: string;
    to?: string;
    search?: string;
    produtoId?: string;
    tipoMovimentacao?: string;
    estado?: string;
    sortBy?: string;
    sortDir?: "asc" | "desc";
  }) {
    const prisma = getPrisma() as any;
    const { page, pageSize } = normalizeTablePagination(params);
    const resolved = resolveDashboardPeriod(params);
    const search = params.search?.trim();
    const sortDir = params.sortDir === "asc" ? "asc" : "desc";

    switch (params.table) {
      case "ultimosMovimentos": {
        const where: any = {
          deletedAt: null,
          createdAt: { gte: resolved.from, lte: resolved.to },
        };
        if (params.produtoId) where.produtoId = BigInt(params.produtoId);
        if (params.tipoMovimentacao) where.tipo = params.tipoMovimentacao;
        if (search) {
          where.OR = [
            { produto: { nomeComercial: { contains: search, mode: "insensitive" } } },
            { lote: { numeroLote: { contains: search, mode: "insensitive" } } },
            { origem: { contains: search, mode: "insensitive" } },
          ];
        }
        const [totalCount, rows] = await prisma.$transaction([
          prisma.estoqueMovimento.count({ where }),
          prisma.estoqueMovimento.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * pageSize,
            take: pageSize + 1,
            select: {
              id: true,
              tipo: true,
              quantidade: true,
              origem: true,
              createdAt: true,
              produto: { select: { nomeComercial: true } },
              lote: { select: { numeroLote: true } },
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
            tipo: row.tipo,
            quantidade: round2(toNumber(row.quantidade)),
            origem: row.origem ?? "—",
            produtoNomeComercial: row.produto?.nomeComercial ?? "—",
            numeroLote: row.lote?.numeroLote ?? "—",
            createdAt: row.createdAt.toISOString(),
          })),
        });
      }
      case "inventarios": {
        const where: any = { iniciadoEm: { gte: resolved.from, lte: resolved.to } };
        if (params.estado) where.status = params.estado;
        if (search) where.codigo = { contains: search, mode: "insensitive" };
        const [totalCount, rows] = await prisma.$transaction([
          prisma.inventario.count({ where }),
          prisma.inventario.findMany({
            where,
            orderBy: { iniciadoEm: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize + 1,
            select: {
              id: true,
              codigo: true,
              status: true,
              iniciadoEm: true,
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
            codigo: row.codigo,
            status: row.status,
            iniciadoEm: row.iniciadoEm.toISOString(),
          })),
        });
      }
      case "requisicoes": {
        const where: any = { createdAt: { gte: resolved.from, lte: resolved.to } };
        if (params.estado) where.status = params.estado;
        if (params.tipoMovimentacao) where.tipo = params.tipoMovimentacao;
        if (search) {
          where.OR = [
            { numeroDocumento: { contains: search, mode: "insensitive" } },
            { tipo: { contains: search, mode: "insensitive" } },
          ];
        }
        const [totalCount, rows] = await prisma.$transaction([
          prisma.requisicao.count({ where }),
          prisma.requisicao.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize + 1,
            select: {
              id: true,
              numeroDocumento: true,
              status: true,
              tipo: true,
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
            numeroDocumento: row.numeroDocumento,
            status: row.status,
            tipo: row.tipo,
            createdAt: row.createdAt.toISOString(),
          })),
        });
      }
      case "reservas": {
        const where: any = { createdAt: { gte: resolved.from, lte: resolved.to } };
        if (params.produtoId) where.produtoId = BigInt(params.produtoId);
        if (search) {
          where.OR = [
            { produto: { nomeComercial: { contains: search, mode: "insensitive" } } },
            { lote: { numeroLote: { contains: search, mode: "insensitive" } } },
          ];
        }
        const [totalCount, rows] = await prisma.$transaction([
          prisma.estoqueReserva.count({ where }),
          prisma.estoqueReserva.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize + 1,
            select: {
              id: true,
              quantidade: true,
              expiresAt: true,
              createdAt: true,
              produto: { select: { nomeComercial: true } },
              lote: { select: { numeroLote: true } },
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
            produtoNomeComercial: row.produto?.nomeComercial ?? "—",
            numeroLote: row.lote?.numeroLote ?? "—",
            quantidade: round2(toNumber(row.quantidade)),
            expiresAt: row.expiresAt.toISOString(),
            createdAt: row.createdAt.toISOString(),
          })),
        });
      }
      case "incineracoes": {
        const where: any = {
          dataIncineracao: { gte: resolved.from, lte: resolved.to },
        };
        if (search) where.numeroAuto = { contains: search, mode: "insensitive" };
        const [totalCount, rows] = await prisma.$transaction([
          prisma.incineracao.count({ where }),
          prisma.incineracao.findMany({
            where,
            orderBy: { dataIncineracao: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize + 1,
            select: {
              id: true,
              numeroAuto: true,
              dataIncineracao: true,
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
            numeroAuto: row.numeroAuto,
            dataIncineracao: row.dataIncineracao.toISOString(),
          })),
        });
      }
      case "produtosCriticos": {
        const where: any = { deletedAt: null, ativo: true };
        if (params.produtoId) where.id = BigInt(params.produtoId);
        if (search) where.nomeComercial = { contains: search, mode: "insensitive" };
        const rows = await prisma.produto.findMany({
          where,
          select: { id: true, nomeComercial: true, estoqueMinimo: true,
            stockBalance: { select: { quantidadeDisponivel: true } },
          },
          take: 500,
        });
        const critical = rows
          .map((row: any) => {
            const disponivel = toNumber(row.stockBalance?.quantidadeDisponivel);
            const minimo = toNumber(row.estoqueMinimo);
            return { id: row.id.toString(), nome: row.nomeComercial,
              disponivel: round2(disponivel),
              minimo: round2(minimo),
              critico: disponivel <= 0 || (disponivel > 0 && disponivel <= minimo),
            };
          })
          .filter((row: any) => row.critico)
          .sort((a: any, b: any) => a.disponivel - b.disponivel);
        const totalCount = critical.length;
        const start = (page - 1) * pageSize;
        const pageRows = critical.slice(start, start + pageSize + 1);
        return buildPagedTableResult({
          table: params.table,
          page,
          pageSize,
          totalCount,
          rows: pageRows,
        });
      }
    }
  }
}
