import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  mirrorToCentralSync,
  recordLocalOutboxEvent,
} from "../../../../../infrastructure/sync/tenant-sync-outbox.service";

const DEFAULT_CATEGORY_NAME = "Medicamentos";

type CategoriaSearchFilters = {
  query?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
};

type CategoriaWritePayload = {
  nome?: string;
  descricao?: string | null;
  ativo?: boolean;
};

export class CategoriaRepository {
  private get prisma(): any {
    return getPrisma() as any;
  }

  async search(filters: CategoriaSearchFilters = {}) {
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
    });

    return {
      items: rows.slice(0, pageSize),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
    };
  }

  async listActive() {
    return this.prisma.categoria.findMany({
      where: {
        ativo: true,
        deletedAt: null,
      },
      orderBy: [{ nome: "asc" }, { id: "asc" }],
    });
  }

  async findById(id: bigint) {
    return this.prisma.categoria.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
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
      (await this.findByNome(DEFAULT_CATEGORY_NAME)) ??
      (await this.prisma.categoria.findFirst({
        where: {
          ativo: true,
          deletedAt: null,
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
}

function serializeCategoriaForSync(categoria: unknown) {
  return JSON.parse(
    JSON.stringify(categoria, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}
