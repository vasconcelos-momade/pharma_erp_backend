import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  mirrorToCentralSync,
  recordLocalOutboxEvent,
} from "../../../../../infrastructure/sync/tenant-sync-outbox.service";
import {
  flattenProdutoForApi,
  mapRequisicaoProduto,
  produtoRequisicaoSelect,
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
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
};

export class ProdutoRepository {
  private get prisma() {
    return getPrisma();
  }

  async create(data: any, userId: bigint) {
    const { catalogData, policy } = prepareProdutoWrite(
      data as Record<string, unknown>,
      "api:create",
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

    const baseWhere = {
      deletedAt: null,
      ...(filters.includeInactive ? {} : { ativo: true }),
      ...(filters.categoriaId ? { categoriaId: filters.categoriaId } : {}),
    };

    if (barcode) {
      const produto = await this.prisma.produto.findFirst({
        where: { ...baseWhere, barcode },
        select: produtoRequisicaoSelect,
      });

      return {
        items: produto
            ? [mapRequisicaoProduto(produto as Record<string, unknown>)]
            : [],
        page: 1,
        pageSize: 1,
        hasMore: false,
      };
    }

    const queryFilters = query
      ? {
          OR: [
            { nome: { contains: query } },
            { substanciaActiva: { contains: query } },
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

    const rows = await this.prisma.produto.findMany({
      where,
      select: produtoRequisicaoSelect,
      orderBy: [{ nome: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });

    const items = rows.map((row: Record<string, unknown>) =>
      mapRequisicaoProduto(row),
    );

    return {
      items: items.slice(0, pageSize),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
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

    const { catalogData, policy } = prepareProdutoWrite(
      data as Record<string, unknown>,
      "api:update",
      policyInputFromProdutoRow(existing as Record<string, unknown>),
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
}

function serializeProdutoForSync(produto: any) {
  return JSON.parse(
    JSON.stringify(produto, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}
