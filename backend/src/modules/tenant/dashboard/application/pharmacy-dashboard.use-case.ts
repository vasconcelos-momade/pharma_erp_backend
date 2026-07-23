import { ProdutoRepository } from "../../products/infrastructure/repositories/produto.repository";
import { CategoriaRepository } from "../../products/infrastructure/repositories/categoria.repository";
import { ValidadesDashboardUseCase } from "../../stock/application/use-cases/lotes/validades.use-case";
import { FefoDashboardUseCase } from "../../stock/application/use-cases/lotes/fefo.use-case";
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
import {
  loadValorStockLotesFromMovements,
  sumValorStockFromLotes,
} from "./dashboard-valor-stock.util";

type PeriodParams = {
  days?: number;
  period?: string;
  from?: string;
  to?: string;
};

type PharmacyTableParams = PeriodParams & {
  table: "produtosCriticos" | "ultimasEntradas" | "ultimasDispensacoes" | "ultimosAlertas";
  page?: number;
  pageSize?: number;
  search?: string;
  produtoId?: string;
  categoriaId?: string;
  tipoMovimentacao?: string;
  estado?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

export class PharmacyDashboardUseCase {
  private produtoRepo = new ProdutoRepository();
  private categoriaRepo = new CategoriaRepository();
  private validadesDashboard = new ValidadesDashboardUseCase();
  private fefoDashboard = new FefoDashboardUseCase();
  private lotesDashboard = new LotesDashboardUseCase();

  async execute(params: PeriodParams = {}) {
    const prisma = getPrisma() as any;
    const resolved = resolveDashboardPeriod(params);
    const days = resolved.days;
    const now = new Date();
    const fromDays = resolved.from;

    const [
      produtos,
      categorias,
      validades,
      fefo,
      lotes,
      produtosRegulacao,
      alertasAbertos,
      ultimasDispensacoes,
      ultimosAlertas,
      produtosSemFornecedor,
      movimentosEntradaSaida,
      topDispensados,
    ] = await Promise.all([
      this.produtoRepo.getDashboard(),
      this.categoriaRepo.getStats(),
      this.validadesDashboard.execute(),
      this.fefoDashboard.execute(),
      this.lotesDashboard.execute(),
      prisma.produtoRegulacao.groupBy({
        by: ["tipoDispensacao"],
        _count: { _all: true },
      }),
      prisma.alertaEstoque.count({ where: { resolvido: false } }),
      prisma.dispensacao.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          quantidade: true,
          tipoDispensacao: true,
          createdAt: true,
          produto: { select: { nomeComercial: true } },
          lote: { select: { numeroLote: true } },
        },
      }),
      prisma.alertaEstoque.findMany({
        where: { resolvido: false },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          tipo: true,
          mensagem: true,
          createdAt: true,
          produto: { select: { nomeComercial: true } },
        },
      }),
      prisma.produto.count({
        where: {
          deletedAt: null,
          ativo: true,
          fornecedores: { none: {} },
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
      prisma.dispensacao.groupBy({
        by: ["produtoId"],
        where: {
          deletedAt: null,
          createdAt: { gte: fromDays },
        },
        _sum: { quantidade: true },
        orderBy: { _sum: { quantidade: "desc" } },
        take: 8,
      }),
    ]);

    const valorStockRows = await loadValorStockLotesFromMovements(prisma, now);
    const valorTotalStock = sumValorStockFromLotes(valorStockRows);

    const antimicrobianos = produtosRegulacao
      .filter((row: any) => row.tipoDispensacao === "RECEITA_NORMAL")
      .reduce((sum: number, row: any) => sum + (row._count._all ?? 0), 0);

    const psicotropicos = produtosRegulacao
      .filter((row: any) => row.tipoDispensacao === "RECEITA_ESPECIAL")
      .reduce((sum: number, row: any) => sum + (row._count._all ?? 0), 0);

    const produtoIds = topDispensados
      .map((row: any) => row.produtoId)
      .filter(Boolean);
    const produtoNomes =
      produtoIds.length > 0
        ? await prisma.produto.findMany({
            where: { id: { in: produtoIds } },
            select: { id: true, nomeComercial: true },
          })
        : [];
    const nomeMap = new Map(
      produtoNomes.map((p: any) => [p.id.toString(), p.nomeComercial]),
    );

    const entradasManuais =
      movimentosEntradaSaida.find((row: any) => row.tipo === "ENTRADA")?._sum
        ?.quantidade ?? 0;
    const entradasCompra =
      movimentosEntradaSaida.find((row: any) => row.tipo === "COMPRA")?._sum
        ?.quantidade ?? 0;
    const saidas =
      movimentosEntradaSaida.find((row: any) => row.tipo === "SAIDA")?._sum
        ?.quantidade ?? 0;

    return {
      kpis: {
        produtosCadastrados: produtos.totalProdutos,
        categorias: categorias.totalCategorias,
        lotesAtivos: lotes.totalLotes,
        produtosAtivos: produtos.produtosActivos,
        produtosSemStock: produtos.produtosSemStock,
        produtosAbaixoMinimo: produtos.produtosStockBaixo,
        antimicrobianos,
        psicotropicos,
        produtosControlados: produtos.produtosControlados,
        alertasSanitarios: lotes.lotesSanitarios + fefo.alertasFefo,
        valorTotalStock: round2(valorTotalStock),
        produtosProximosValidade:
          (validades.expiramEm30Dias ?? 0) + (validades.lotesExpirados ?? 0),
        alertasAbertos,
        produtosSemFornecedor,
      },
      charts: {
        produtosPorCategoria: categorias.items.map((item: any) => ({
          categoria: item.nome,
          totalProdutos: item.totalProdutos,
          stockDisponivel: item.stockDisponivel,
        })),
        produtosPorRegulacao: produtosRegulacao.map((row: any) => ({
          regulacao: row.tipoDispensacao,
          total: row._count._all ?? 0,
        })),
        stockPorCategoria: categorias.items.map((item: any) => ({
          categoria: item.nome,
          stock: item.stockDisponivel,
        })),
        entradasSaidas: [
          { tipo: "ENTRADA", quantidade: round2(toNumber(entradasManuais)) },
          { tipo: "COMPRA", quantidade: round2(toNumber(entradasCompra)) },
          { tipo: "SAIDA", quantidade: round2(toNumber(saidas)) },
        ],
        produtosMaisDispensados: topDispensados.map((row: any) => ({
          produtoId: row.produtoId?.toString() ?? null,
          produtoNomeComercial: nomeMap.get(row.produtoId?.toString() ?? "") ?? "—",
          quantidade: round2(toNumber(row._sum.quantidade)),
        })),
        validades,
        fefo,
      },
      tables: {
        produtosCriticos: await this.listProdutosCriticos(prisma),
        ultimasDispensacoes: ultimasDispensacoes.map((row: any) => ({
          id: row.id.toString(),
          produtoNomeComercial: row.produto?.nomeComercial ?? "—",
          numeroLote: row.lote?.numeroLote ?? "—",
          quantidade: round2(toNumber(row.quantidade)),
          tipoDispensacao: row.tipoDispensacao,
          createdAt: row.createdAt.toISOString(),
        })),
        ultimosAlertas: ultimosAlertas.map((row: any) => ({
          id: row.id.toString(),
          tipo: row.tipo,
          mensagem: row.mensagem,
          produtoNomeComercial: row.produto?.nomeComercial ?? "—",
          createdAt: row.createdAt.toISOString(),
        })),
        ultimasEntradas: await this.listUltimasEntradas(prisma),
        produtosSemFornecedor: produtosSemFornecedor,
      },
      validades,
      fefo,
      lotes,
      produtos,
      categorias,
      periodo: serializePeriodo(resolved),
    };
  }

  async listTable(params: PharmacyTableParams) {
    const prisma = getPrisma() as any;
    const { page, pageSize } = normalizeTablePagination(params);
    const resolved = resolveDashboardPeriod(params);
    const search = params.search?.trim();
    const sortDir = params.sortDir === "asc" ? "asc" : "desc";

    switch (params.table) {
      case "produtosCriticos": {
        const where: any = { deletedAt: null, ativo: true };
        if (params.produtoId) where.id = BigInt(params.produtoId);
        if (params.categoriaId) where.categoriaId = BigInt(params.categoriaId);
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
      case "ultimasEntradas": {
        const where: any = {
          deletedAt: null,
          tipo: { in: ["ENTRADA", "COMPRA"] },
          createdAt: { gte: resolved.from, lte: resolved.to },
        };
        if (params.produtoId) where.produtoId = BigInt(params.produtoId);
        if (params.tipoMovimentacao) where.origem = params.tipoMovimentacao;
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
            orderBy: { createdAt: sortDir },
            skip: (page - 1) * pageSize,
            take: pageSize + 1,
            select: {
              id: true,
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
            produtoNomeComercial: row.produto?.nomeComercial ?? "—",
            numeroLote: row.lote?.numeroLote ?? "—",
            quantidade: round2(toNumber(row.quantidade)),
            origem: row.origem ?? "—",
            createdAt: row.createdAt.toISOString(),
          })),
        });
      }
      case "ultimasDispensacoes": {
        const where: any = {
          createdAt: { gte: resolved.from, lte: resolved.to },
        };
        if (params.produtoId) where.produtoId = BigInt(params.produtoId);
        if (params.estado) where.tipoDispensacao = params.estado;
        if (search) {
          where.OR = [
            { produto: { nomeComercial: { contains: search, mode: "insensitive" } } },
            { lote: { numeroLote: { contains: search, mode: "insensitive" } } },
          ];
        }
        const [totalCount, rows] = await prisma.$transaction([
          prisma.dispensacao.count({ where }),
          prisma.dispensacao.findMany({
            where,
            orderBy: { createdAt: sortDir },
            skip: (page - 1) * pageSize,
            take: pageSize + 1,
            select: {
              id: true,
              quantidade: true,
              tipoDispensacao: true,
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
            tipoDispensacao: row.tipoDispensacao,
            createdAt: row.createdAt.toISOString(),
          })),
        });
      }
      case "ultimosAlertas": {
        const where: any = {
          createdAt: { gte: resolved.from, lte: resolved.to },
        };
        if (search) {
          where.OR = [
            { mensagem: { contains: search, mode: "insensitive" } },
            { produto: { nomeComercial: { contains: search, mode: "insensitive" } } },
          ];
        }
        const [totalCount, rows] = await prisma.$transaction([
          prisma.alertaEstoque.count({ where }),
          prisma.alertaEstoque.findMany({
            where,
            orderBy: { createdAt: sortDir },
            skip: (page - 1) * pageSize,
            take: pageSize + 1,
            select: {
              id: true,
              tipo: true,
              mensagem: true,
              createdAt: true,
              produto: { select: { nomeComercial: true } },
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
            mensagem: row.mensagem,
            produtoNomeComercial: row.produto?.nomeComercial ?? "—",
            createdAt: row.createdAt.toISOString(),
          })),
        });
      }
    }
  }

  private async listProdutosCriticos(prisma: any) {
    const now = new Date();
    const rows = await prisma.produto.findMany({
      where: { deletedAt: null, ativo: true },
      select: {
        id: true,
        nomeComercial: true,
        estoqueMinimo: true,
        stockBalance: { select: { quantidadeDisponivel: true } },
        lotes: {
          where: {
            deletedAt: null,
            ativo: true,
            stockBalance: { quantidadeDisponivel: { gt: 0 } },
            dataValidade: { gte: now },
          },
          orderBy: { dataValidade: "asc" },
          take: 1,
          select: { dataValidade: true },
        },
      },
      take: 200,
    });
    return rows
      .map((row: any) => {
        const disponivel = toNumber(row.stockBalance?.quantidadeDisponivel);
        const minimo = toNumber(row.estoqueMinimo);
        return {
          id: row.id.toString(),
          nome: row.nomeComercial,
          disponivel: round2(disponivel),
          minimo: round2(minimo),
          validade: row.lotes?.[0]?.dataValidade?.toISOString?.() ?? null,
          critico: disponivel <= 0 || (disponivel > 0 && disponivel <= minimo),
        };
      })
      .filter((row: any) => row.critico)
      .slice(0, 5);
  }

  private async listUltimasEntradas(prisma: any) {
    const rows = await prisma.estoqueMovimento.findMany({
      where: { deletedAt: null, tipo: { in: ["ENTRADA", "COMPRA"] } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        quantidade: true,
        origem: true,
        createdAt: true,
        produto: { select: { nomeComercial: true } },
        lote: { select: { numeroLote: true } },
      },
    });
    return rows.map((row: any) => ({
      id: row.id.toString(),
      produtoNomeComercial: row.produto?.nomeComercial ?? "—",
      numeroLote: row.lote?.numeroLote ?? "—",
      quantidade: round2(toNumber(row.quantidade)),
      origem: row.origem ?? "—",
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
