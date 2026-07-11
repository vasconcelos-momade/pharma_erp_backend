import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  mapStockSearchProduto,
  produtoStockSearchSelect,
} from "../../../../products/domain/produto-presenter";

export class SearchStockProdutosUseCase {
  async execute(params?: {
    q?: string;
    categoriaId?: bigint;
    page?: number;
    pageSize?: number;
  }) {
    const prisma = getPrisma() as any;
    const searchTerm = params?.q?.trim() || undefined;
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 20));

    const baseWhere = {
      ativo: true,
      deletedAt: null,
      ...(params?.categoriaId ? { categoriaId: params.categoriaId } : {}),
    };

    const queryFilters = searchTerm
      ? {
          OR: [
            { nomeComercial: { contains: searchTerm } },
            { nomeGenerico: { contains: searchTerm } },
            { barcode: { contains: searchTerm } },
            {
              categoria: {
                is: {
                  nome: { contains: searchTerm },
                  deletedAt: null,
                },
              },
            },
            {
              lotes: {
                some: {
                  numeroLote: { contains: searchTerm },
                  ativo: true,
                  deletedAt: null,
                },
              },
            },
            ...(/^\d+$/.test(searchTerm) ? [{ id: BigInt(searchTerm) }] : []),
          ],
        }
      : {};

    const where = {
      ...baseWhere,
      ...(searchTerm ? queryFilters : {}),
    };

    const items = await prisma.produto.findMany({
      where,
      select: produtoStockSearchSelect,
      orderBy: [{ nomeComercial: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });

    const mapped = items.map((row: any) =>
      mapStockSearchProduto(row as Record<string, unknown>),
    );

    return {
      items: mapped.slice(0, pageSize),
      page,
      pageSize,
      hasMore: items.length > pageSize,
    };
  }
}
