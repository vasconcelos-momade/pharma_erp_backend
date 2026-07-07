import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  mirrorToCentralSync,
  recordLocalOutboxEvent,
} from "../../../../../infrastructure/sync/tenant-sync-outbox.service";
import { FNM_CATEGORIAS } from "../../domain/fnm-categorias";

const DEFAULT_CATEGORY_CODIGO = "SISTEMA_NERVOSO_CENTRAL";

type CategoriaSearchFilters = {
  query?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
};

type CategoriaWritePayload = {
  nome?: string;
  codigoFNM?: string | null;
  descricao?: string | null;
  ativo?: boolean;
};

export class CategoriaRepository {
  private get prisma(): any {
    return getPrisma() as any;
  }

  async search(filters: CategoriaSearchFilters = {}) {
    await this.ensureFnmCategoriasSeeded();

    const query = filters.query?.trim() || undefined;
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));

    const where = {
      deletedAt: null,
      ...(filters.includeInactive ? {} : { ativo: true }),
      ...(query
        ? {
            OR: [
              { nome: { contains: query } },
              { descricao: { contains: query } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.categoria.findMany({
      where,
      orderBy: [{ nome: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
      include: {
        _count: {
          select: {
            produtos: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    const items = rows.slice(0, pageSize).map((row: any) => ({
      ...row,
      productCount: row._count?.produtos ?? 0,
      _count: undefined,
    }));

    const totalCount = await this.prisma.categoria.count({ where });

    return {
      items,
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }

  async listActive() {
    await this.ensureFnmCategoriasSeeded();

    return this.prisma.categoria.findMany({
      where: {
        ativo: true,
        deletedAt: null,
      },
      orderBy: [{ nome: "asc" }, { id: "asc" }],
    });
  }

  async getStats() {
    await this.ensureFnmCategoriasSeeded();

    const categorias = await this.prisma.categoria.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        nome: true,
        ativo: true,
        produtos: {
          where: { deletedAt: null },
          select: {
            id: true,
            ativo: true,
            stockBalance: {
              select: {
                quantidadeDisponivel: true,
              },
            },
          },
        },
      },
      orderBy: [{ nome: "asc" }, { id: "asc" }],
    });

    const items = categorias.map((categoria: any) => {
      const totalProdutos = categoria.produtos.length;
      const produtosActivos = categoria.produtos.filter((produto: any) => produto.ativo).length;
      const produtosInactivos = totalProdutos - produtosActivos;
      const stockDisponivel = categoria.produtos.reduce(
        (sum: number, produto: any) =>
          sum + Number(produto.stockBalance?.quantidadeDisponivel ?? 0),
        0,
      );

      return {
        id: categoria.id.toString(),
        nome: categoria.nome,
        activo: Boolean(categoria.ativo),
        totalProdutos,
        produtosActivos,
        produtosInactivos,
        stockDisponivel: Math.round(stockDisponivel * 100) / 100,
      };
    });

    return {
      totalCategorias: items.length,
      categoriasActivas: items.filter((item: any) => item.activo).length,
      categoriasInactivas: items.filter((item: any) => !item.activo).length,
      totalProdutos: items.reduce((sum: number, item: any) => sum + item.totalProdutos, 0),
      stockDisponivel: Math.round(
        items.reduce((sum: number, item: any) => sum + item.stockDisponivel, 0) * 100,
      ) / 100,
      items,
    };
  }

  async findById(id: bigint) {
    const row = await this.prisma.categoria.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            produtos: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    if (!row) {
      return null;
    }

    return {
      ...row,
      productCount: row._count?.produtos ?? 0,
      _count: undefined,
    };
  }

  async findByNome(nome: string) {
    return this.prisma.categoria.findFirst({
      where: {
        nome,
        deletedAt: null,
      },
    });
  }

  async findDefaultCategory() {
    return (
      (await this.prisma.categoria.findFirst({
        where: {
          codigoFNM: DEFAULT_CATEGORY_CODIGO,
          deletedAt: null,
        },
      })) ??
      (await this.prisma.categoria.findFirst({
        where: {
          ativo: true,
          deletedAt: null,
          codigoFNM: { not: null },
        },
        orderBy: [{ nome: "asc" }, { id: "asc" }],
      }))
    );
  }

  async create(data: CategoriaWritePayload, userId: bigint) {
    const created = await this.prisma.$transaction(async (tx: any) => {
      const categoria = await tx.categoria.create({
        data: {
          nome: data.nome,
          codigoFNM: data.codigoFNM ?? data.nome,
          descricao: data.descricao ?? null,
          ativo: data.ativo ?? true,
        },
      });

      await recordLocalOutboxEvent(tx, {
        userId,
        type: "CATEGORIA_CREATED",
        entity: "Categoria",
        entityId: categoria.id,
        payload: serializeCategoriaForSync(categoria),
      });

      return categoria;
    });

    await mirrorToCentralSync({
      entity: "Categoria",
      entityId: created.id,
      operation: "CREATE",
      payload: serializeCategoriaForSync(created),
    });

    return created;
  }

  async update(id: bigint, data: CategoriaWritePayload, userId: bigint) {
    const updated = await this.prisma.$transaction(async (tx: any) => {
      const categoria = await tx.categoria.update({
        where: { id },
        data: {
          ...(data.nome !== undefined ? { nome: data.nome } : {}),
          ...(data.codigoFNM !== undefined ? { codigoFNM: data.codigoFNM } : {}),
          ...(data.descricao !== undefined ? { descricao: data.descricao } : {}),
          ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
        },
      });

      await recordLocalOutboxEvent(tx, {
        userId,
        type: "CATEGORIA_UPDATED",
        entity: "Categoria",
        entityId: categoria.id,
        payload: serializeCategoriaForSync(categoria),
      });

      return categoria;
    });

    await mirrorToCentralSync({
      entity: "Categoria",
      entityId: updated.id,
      operation: "UPDATE",
      payload: serializeCategoriaForSync(updated),
    });

    return updated;
  }

  async countLinkedProducts(id: bigint) {
    return this.prisma.produto.count({
      where: {
        categoriaId: id,
        deletedAt: null,
      },
    });
  }

  async softDelete(id: bigint, userId: bigint) {
    const deleted = await this.prisma.$transaction(async (tx: any) => {
      const categoria = await tx.categoria.update({
        where: { id },
        data: {
          ativo: false,
          deletedAt: new Date(),
        },
      });

      await recordLocalOutboxEvent(tx, {
        userId,
        type: "CATEGORIA_DELETED",
        entity: "Categoria",
        entityId: categoria.id,
        payload: serializeCategoriaForSync(categoria),
      });

      return categoria;
    });

    await mirrorToCentralSync({
      entity: "Categoria",
      entityId: deleted.id,
      operation: "DELETE",
      payload: serializeCategoriaForSync(deleted),
    });

    return deleted;
  }

  private async ensureFnmCategoriasSeeded() {
    for (const item of FNM_CATEGORIAS) {
      const existing = await this.prisma.categoria.findFirst({
        where: {
          OR: [
            { codigoFNM: item.codigoFNM },
            { nome: item.nome },
          ],
        },
        orderBy: [{ id: "asc" }],
      });

      if (!existing) {
        await this.prisma.categoria.create({
          data: {
            nome: item.nome,
            codigoFNM: item.codigoFNM,
            descricao: "Categoria terapêutica FNM (Nível 1)",
            ativo: true,
          },
        });
        continue;
      }

      const data: Record<string, unknown> = {};
      if (existing.nome !== item.nome) data.nome = item.nome;
      if (existing.codigoFNM !== item.codigoFNM) data.codigoFNM = item.codigoFNM;
      if (!existing.descricao) {
        data.descricao = "Categoria terapêutica FNM (Nível 1)";
      }
      if (existing.ativo !== true) data.ativo = true;
      if (existing.deletedAt != null) data.deletedAt = null;

      if (Object.keys(data).length > 0) {
        await this.prisma.categoria.update({
          where: { id: existing.id },
          data,
        });
      }
    }
  }
}

function serializeCategoriaForSync(categoria: unknown) {
  return JSON.parse(
    JSON.stringify(categoria, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}
