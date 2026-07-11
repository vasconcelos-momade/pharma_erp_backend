import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  mirrorToCentralSync,
  recordLocalOutboxEvent,
} from "../../../../../infrastructure/sync/tenant-sync-outbox.service";
import {
  flattenProdutoForApi,
  mapMasterProdutoListItem,
  produtoMasterListSelect,
  produtoWithRegulacaoInclude,
} from "../../domain/produto-presenter";
import {
  persistProdutoRegulacao,
  policyInputFromProdutoRow,
  prepareProdutoWrite,
  toProdutoRegulacaoTx,
} from "../../domain/produto-regulacao.persistence";

type ProdutoSearchFilters = {
  query?: string;
  barcode?: string;
  categoriaId?: bigint;
  fornecedorId?: bigint;
  tipoDispensacao?: string;
  ativo?: boolean;
  includeInactive?: boolean;
  sortBy?: "nomeComercial" | "nome" | "estoqueAtual" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

function buildProdutoOrderBy(
  sortBy: ProdutoSearchFilters["sortBy"],
  sortOrder: ProdutoSearchFilters["sortOrder"],
): any {
  const direction: "asc" | "desc" = sortOrder === "desc" ? "desc" : "asc";
  switch (sortBy) {
    case "estoqueAtual":
      return [{ stockBalance: { quantidadeDisponivel: direction } }, { nomeComercial: "asc" }];
    case "createdAt":
      return [{ createdAt: direction }, { id: direction }];
    case "nome":
    case "nomeComercial":
    default:
      return [{ nomeComercial: direction }, { id: direction }];
  }
}

export class ProdutoRepository {
  private get prisma() {
    return getPrisma();
  }

  async create(data: any, userId: bigint) {
    const categoria = data.categoriaId
      ? await this.prisma.categoria.findUnique({
          where: { id: BigInt(data.categoriaId) },
          select: { nome: true, codigoFNM: true },
        })
      : null;
    const { catalogData, policy } = prepareProdutoWrite(
      data as Record<string, unknown>,
      "api:create",
      null,
      categoria,
    );

    const created = await this.prisma.$transaction(async (tx: any) => {
      const produto = await tx.produto.create({
        data: catalogData,
        include: produtoWithRegulacaoInclude,
      });
      await persistProdutoRegulacao(toProdutoRegulacaoTx(tx), produto.id, policy, "api:create");
      const withRegulacao = await tx.produto.findUnique({
        where: { id: produto.id },
        include: produtoWithRegulacaoInclude,
      });
      await recordLocalOutboxEvent(tx, {
        userId,
        type: "PRODUTO_CREATED",
        entity: "Produto",
        entityId: produto.id,
        payload: serializeProdutoForSync(withRegulacao),
      });
      return withRegulacao;
    });

    const flat = flattenProdutoForApi(created as Record<string, unknown>);

    await mirrorToCentralSync({
      entity: "Produto",
      entityId: created.id,
      operation: "CREATE",
      payload: serializeProdutoForSync(flat),
    });

    return flat;
  }

  async search(filters: ProdutoSearchFilters = {}) {
    const query = filters.query?.trim() || undefined;
    const barcode = filters.barcode?.trim() || undefined;
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const sortBy =
      filters.sortBy === "nome" ? "nomeComercial" : (filters.sortBy ?? "nomeComercial");
    const sortOrder = filters.sortOrder ?? "asc";

    const baseWhere: Record<string, unknown> = {
      deletedAt: null,
      ...(filters.categoriaId ? { categoriaId: filters.categoriaId } : {}),
      ...(filters.fornecedorId
        ? {
            fornecedores: {
              some: { fornecedorId: filters.fornecedorId },
            },
          }
        : {}),
      ...(filters.tipoDispensacao
        ? {
            regulacao: {
              is: { tipoDispensacao: filters.tipoDispensacao },
            },
          }
        : {}),
    };

    if (filters.ativo !== undefined) {
      baseWhere.ativo = filters.ativo;
    } else if (!filters.includeInactive) {
      baseWhere.ativo = true;
    }

    if (barcode) {
      const produto = await this.prisma.produto.findFirst({
        where: { ...baseWhere, barcode },
        select: produtoMasterListSelect,
      });

      return {
        items: produto
          ? [mapMasterProdutoListItem(produto as Record<string, unknown>)]
          : [],
        page: 1,
        pageSize: 1,
        hasMore: false,
        totalCount: produto ? 1 : 0,
      };
    }

    const queryFilters = query
      ? {
          OR: [
            { nomeComercial: { contains: query } },
            { nomeGenerico: { contains: query } },
            { barcode: { contains: query } },
            {
              categoria: {
                is: {
                  nome: { contains: query },
                  deletedAt: null,
                },
              },
            },
            {
              lotes: {
                some: {
                  numeroLote: { contains: query },
                  ativo: true,
                  deletedAt: null,
                },
              },
            },
            ...(/^\d+$/.test(query) ? [{ id: BigInt(query) }] : []),
          ],
        }
      : {};

    const where = {
      ...baseWhere,
      ...(query ? queryFilters : {}),
    };

    const [totalCount, rows] = await this.prisma.$transaction([
      this.prisma.produto.count({ where }),
      this.prisma.produto.findMany({
        where,
        select: produtoMasterListSelect,
        orderBy: buildProdutoOrderBy(sortBy, sortOrder),
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
    ]);

    const items = rows.map((row: Record<string, unknown>) =>
      mapMasterProdutoListItem(row),
    );

    return {
      items: items.slice(0, pageSize),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }

  async getDashboard() {
    const prisma = this.prisma as any;
    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    const [productRows, produtosComLotes, produtosComValidadeCritica] =
      await prisma.$transaction([
        prisma.produto.findMany({
          where: { deletedAt: null },
          select: {
            ativo: true,
            estoqueMinimo: true,
            stockBalance: {
              select: {
                quantidadeDisponivel: true,
              },
            },
            regulacao: {
              select: {
                tipoDispensacao: true,
              },
            },
          },
        }),
        prisma.produto.count({
          where: {
            deletedAt: null,
            lotes: {
              some: {
                ativo: true,
                deletedAt: null,
              },
            },
          },
        }),
        prisma.produto.count({
          where: {
            deletedAt: null,
            ativo: true,
            lotes: {
              some: {
                ativo: true,
                deletedAt: null,
                stockBalance: { quantidadeDisponivel: { gt: 0 } },
                dataValidade: { lte: in30Days },
              },
            },
          },
        }),
      ]);

    const summary = productRows.reduce(
      (acc: {
        total: number;
        ativos: number;
        inativos: number;
        semStock: number;
        stockBaixo: number;
        controlados: number;
        estoqueDisponivel: number;
      }, row: any) => {
        const ativo = Boolean(row.ativo);
        const disponivel = Number(row.stockBalance?.quantidadeDisponivel ?? 0);
        const estoqueMinimo = Number(row.estoqueMinimo ?? 0);
        const tipoDispensacao = row.regulacao?.tipoDispensacao ?? "VENDA_LIVRE";

        acc.total += 1;
        acc.estoqueDisponivel += disponivel;
        if (ativo) acc.ativos += 1;
        else acc.inativos += 1;
        if (disponivel <= 0) acc.semStock += 1;
        if (ativo && disponivel > 0 && disponivel <= estoqueMinimo) {
          acc.stockBaixo += 1;
        }
        if (tipoDispensacao !== "VENDA_LIVRE") {
          acc.controlados += 1;
        }
        return acc;
      },
      {
        total: 0,
        ativos: 0,
        inativos: 0,
        semStock: 0,
        stockBaixo: 0,
        controlados: 0,
        estoqueDisponivel: 0,
      },
    );

    return {
      totalProdutos: summary.total,
      produtosActivos: summary.ativos,
      produtosInactivos: summary.inativos,
      produtosSemStock: summary.semStock,
      produtosStockBaixo: summary.stockBaixo,
      produtosControlados: summary.controlados,
      produtosComLotes,
      produtosComValidadeCritica,
      unidadesDisponiveis: Math.round(summary.estoqueDisponivel * 100) / 100,
    };
  }

  async findById(id: bigint) {
    const row = await this.prisma.produto.findFirst({
      where: { id },
      include: produtoWithRegulacaoInclude,
    });
    if (!row) return null;
    return flattenProdutoForApi(row as Record<string, unknown>);
  }

  async findByBarcode(barcode: string) {
    const row = await this.prisma.produto.findFirst({
      where: {
        barcode,
        deletedAt: null,
      },
      include: produtoWithRegulacaoInclude,
    });
    if (!row) return null;
    return flattenProdutoForApi(row as Record<string, unknown>);
  }

  async update(id: bigint, data: any, userId: bigint) {
    const existing = await this.prisma.produto.findFirst({
      where: { id },
      include: produtoWithRegulacaoInclude,
    });
    if (!existing) {
      throw new Error("Produto não encontrado");
    }

    const categoriaId =
      data.categoriaId != null
        ? BigInt(data.categoriaId)
        : (existing as { categoriaId?: bigint }).categoriaId;
    const categoria = categoriaId
      ? await this.prisma.categoria.findUnique({
          where: { id: categoriaId },
          select: { nome: true, codigoFNM: true },
        })
      : null;

    const { catalogData, policy } = prepareProdutoWrite(
      data as Record<string, unknown>,
      "api:update",
      policyInputFromProdutoRow(existing as Record<string, unknown>),
      categoria,
    );

    const updated = await this.prisma.$transaction(async (tx: any) => {
      await tx.produto.update({
        where: { id },
        data: catalogData,
      });
      await persistProdutoRegulacao(toProdutoRegulacaoTx(tx), id, policy, "api:update");
      const withRegulacao = await tx.produto.findUnique({
        where: { id },
        include: produtoWithRegulacaoInclude,
      });
      await recordLocalOutboxEvent(tx, {
        userId,
        type: "PRODUTO_UPDATED",
        entity: "Produto",
        entityId: id,
        payload: serializeProdutoForSync(withRegulacao),
      });
      return withRegulacao;
    });

    const flat = flattenProdutoForApi(updated as Record<string, unknown>);

    await mirrorToCentralSync({
      entity: "Produto",
      entityId: updated.id,
      operation: "UPDATE",
      payload: serializeProdutoForSync(flat),
    });

    return flat;
  }

  async softDelete(id: bigint, userId: bigint) {
    const deleted = await this.prisma.$transaction(async (tx: any) => {
      const produto = await tx.produto.update({
        where: { id },
        data: { ativo: false },
        include: produtoWithRegulacaoInclude,
      });
      await recordLocalOutboxEvent(tx, {
        userId,
        type: "PRODUTO_DELETED",
        entity: "Produto",
        entityId: produto.id,
        payload: serializeProdutoForSync(produto),
      });
      return produto;
    });

    const flat = flattenProdutoForApi(deleted as Record<string, unknown>);

    await mirrorToCentralSync({
      entity: "Produto",
      entityId: deleted.id,
      operation: "DELETE",
      payload: serializeProdutoForSync(flat),
    });

    return flat;
  }

  async listSuppliers(produtoId: bigint) {
    const rows = await (this.prisma as any).produtoFornecedor.findMany({
      where: { produtoId },
      include: {
        fornecedor: {
          select: {
            id: true,
            nome: true,
            nuit: true,
            email: true,
            telefone: true,
            cidade: true,
            provincia: true,
            ativo: true,
          },
        },
      },
      orderBy: [
        { fornecedorPrincipal: "desc" },
        { fornecedor: { nome: "asc" } },
      ],
    });

    return rows.map((row: any) => ({
      id: row.id.toString(),
      precoCompra: Number(row.precoCompra ?? 0),
      fornecedorPrincipal: Boolean(row.fornecedorPrincipal),
      prazoEntregaDias: row.prazoEntregaDias ?? null,
      codigoFornecedor: row.codigoFornecedor ?? null,
      fornecedor: row.fornecedor
        ? {
            id: row.fornecedor.id.toString(),
            nome: row.fornecedor.nome,
            nuit: row.fornecedor.nuit ?? null,
            email: row.fornecedor.email ?? null,
            telefone: row.fornecedor.telefone ?? null,
            cidade: row.fornecedor.cidade ?? null,
            provincia: row.fornecedor.provincia ?? null,
            ativo: Boolean(row.fornecedor.ativo),
          }
        : null,
    }));
  }

  async listClassificationHistory(produtoId: bigint, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const where = { produtoId };

    const [totalCount, rows] = await (this.prisma as any).$transaction([
      (this.prisma as any).produtoClassificacaoEvento.count({ where }),
      (this.prisma as any).produtoClassificacaoEvento.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (safePage - 1) * safeSize,
        take: safeSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, safeSize).map((row: any) => ({
        id: row.id.toString(),
        source: row.source,
        observacao: row.observacao ?? null,
        snapshot: row.snapshot ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      page: safePage,
      pageSize: safeSize,
      hasMore: rows.length > safeSize,
      totalCount,
    };
  }

  async listAuditLogs(produtoId: bigint, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const where = {
      entity: "Produto",
      entityId: produtoId,
    };

    const [totalCount, rows] = await (this.prisma as any).$transaction([
      (this.prisma as any).auditLog.count({ where }),
      (this.prisma as any).auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (safePage - 1) * safeSize,
        take: safeSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, safeSize).map((row: any) => ({
        id: row.id.toString(),
        action: row.action,
        entity: row.entity,
        before: row.before ?? null,
        after: row.after ?? null,
        ip: row.ip ?? null,
        userAgent: row.userAgent ?? null,
        createdAt: row.createdAt.toISOString(),
        user: row.user
          ? {
              id: row.user.id.toString(),
              nome: row.user.name,
              email: row.user.email ?? null,
            }
          : null,
      })),
      page: safePage,
      pageSize: safeSize,
      hasMore: rows.length > safeSize,
      totalCount,
    };
  }
}

function serializeProdutoForSync(produto: any) {
  return JSON.parse(
    JSON.stringify(produto, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}
