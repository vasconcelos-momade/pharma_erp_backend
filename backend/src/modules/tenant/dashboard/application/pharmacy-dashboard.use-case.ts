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
      valorStockRows,
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
      prisma.lote.findMany({
        where: {
          deletedAt: null,
          ativo: true,
          quantidadeAtual: { gt: 0 },
        },
        select: {
          quantidadeAtual: true,
          quantidadeQuarentena: true,
          precoCompra: true,
        },
      }),
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
          produto: { select: { nome: true } },
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
          produto: { select: { nome: true } },
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

    const valorTotalStock = valorStockRows.reduce((sum: number, row: any) => {
      const qty = Math.max(
        0,
        toNumber(row.quantidadeAtual) - toNumber(row.quantidadeQuarentena),
      );
      return sum + qty * toNumber(row.precoCompra);
    }, 0);

    const antimicrobianos = produtosRegulacao
      .filter((row: any) =>
        ["RECEITA_OBRIGATORIA", "RECEITA_CONTROLADA"].includes(row.tipoDispensacao),
      )
      .reduce((sum: number, row: any) => sum + (row._count._all ?? 0), 0);

    const psicotropicos = produtosRegulacao
      .filter((row: any) => row.tipoDispensacao === "PSICOTROPICO")
      .reduce((sum: number, row: any) => sum + (row._count._all ?? 0), 0);

    const produtoIds = topDispensados
      .map((row: any) => row.produtoId)
      .filter(Boolean);
    const produtoNomes =
      produtoIds.length > 0
        ? await prisma.produto.findMany({
            where: { id: { in: produtoIds } },
            select: { id: true, nome: true },
          })
        : [];
    const nomeMap = new Map(
      produtoNomes.map((p: any) => [p.id.toString(), p.nome]),
    );

    const entradas =
      movimentosEntradaSaida.find((row: any) => row.tipo === "ENTRADA")?._sum
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
          { tipo: "ENTRADA", quantidade: round2(toNumber(entradas)) },
          { tipo: "SAIDA", quantidade: round2(toNumber(saidas)) },
        ],
        produtosMaisDispensados: topDispensados.map((row: any) => ({
          produtoId: row.produtoId?.toString() ?? null,
          produtoNome: nomeMap.get(row.produtoId?.toString() ?? "") ?? "—",
          quantidade: round2(toNumber(row._sum.quantidade)),
        })),
        validades,
        fefo,
      },
      tables: {
        produtosCriticos: await this.listProdutosCriticos(prisma),
        ultimasDispensacoes: ultimasDispensacoes.map((row: any) => ({
          id: row.id.toString(),
          produtoNome: row.produto?.nome ?? "—",
          numeroLote: row.lote?.numeroLote ?? "—",
          quantidade: round2(toNumber(row.quantidade)),
          tipoDispensacao: row.tipoDispensacao,
          createdAt: row.createdAt.toISOString(),
        })),
        ultimosAlertas: ultimosAlertas.map((row: any) => ({
          id: row.id.toString(),
          tipo: row.tipo,
          mensagem: row.mensagem,
          produtoNome: row.produto?.nome ?? "—",
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
        if (search) where.nome = { contains: search, mode: "insensitive" };
        const rows = await prisma.produto.findMany({
          where,
          select: {
            id: true,
            nome: true,
            estoqueMinimo: true,
            stockBalance: { select: { quantidadeDisponivel: true } },
          },
          take: 500,
        });
        const critical = rows
          .map((row: any) => {
            const disponivel = toNumber(row.stockBalance?.quantidadeDisponivel);
            const minimo = toNumber(row.estoqueMinimo);
            return {
              id: row.id.toString(),
              nome: row.nome,
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
          tipo: "ENTRADA",
          createdAt: { gte: resolved.from, lte: resolved.to },
        };
        if (params.produtoId) where.produtoId = BigInt(params.produtoId);
        if (params.tipoMovimentacao) where.origem = params.tipoMovimentacao;
        if (search) {
          where.OR = [
            { produto: { nome: { contains: search, mode: "insensitive" } } },
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
              produto: { select: { nome: true } },
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
            produtoNome: row.produto?.nome ?? "—",
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
            { produto: { nome: { contains: search, mode: "insensitive" } } },
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
              produto: { select: { nome: true } },
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
            produtoNome: row.produto?.nome ?? "—",
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
            { produto: { nome: { contains: search, mode: "insensitive" } } },
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
              produto: { select: { nome: true } },
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
            produtoNome: row.produto?.nome ?? "—",
            createdAt: row.createdAt.toISOString(),
          })),
        });
      }
    }
  }

  private async listProdutosCriticos(prisma: any) {
    const rows = await prisma.produto.findMany({
      where: { deletedAt: null, ativo: true },
      select: {
        id: true,
        nome: true,
        estoqueMinimo: true,
        stockBalance: { select: { quantidadeDisponivel: true } },
      },
      take: 200,
    });
    return rows
      .map((row: any) => {
        const disponivel = toNumber(row.stockBalance?.quantidadeDisponivel);
        const minimo = toNumber(row.estoqueMinimo);
        return {
          id: row.id.toString(),
          nome: row.nome,
          disponivel: round2(disponivel),
          minimo: round2(minimo),
          critico: disponivel <= 0 || (disponivel > 0 && disponivel <= minimo),
        };
      })
      .filter((row: any) => row.critico)
      .slice(0, 10);
  }

  private async listUltimasEntradas(prisma: any) {
    const rows = await prisma.estoqueMovimento.findMany({
      where: { deletedAt: null, tipo: "ENTRADA" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        quantidade: true,
        origem: true,
        createdAt: true,
        produto: { select: { nome: true } },
        lote: { select: { numeroLote: true } },
      },
    });
    return rows.map((row: any) => ({
      id: row.id.toString(),
      produtoNome: row.produto?.nome ?? "—",
      numeroLote: row.lote?.numeroLote ?? "—",
      quantidade: round2(toNumber(row.quantidade)),
      origem: row.origem ?? "—",
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
