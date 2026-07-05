import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  mapPosProduto,
  produtoPosSelect,
  produtoPosStockWhere,
} from "../../../products/domain/produto-presenter";

export class SearchProdutosUseCase {
  async execute(params?: {
    query?: string;
    barcode?: string;
    categoriaId?: bigint;
    page?: number;
    pageSize?: number;
  }) {
    const prisma = getPrisma() as any;
    const query = params?.query?.trim() || undefined;
    const barcode = params?.barcode?.trim() || undefined;
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 20));

    const baseWhere = {
      ativo: true,
      deletedAt: null,
      ...produtoPosStockWhere,
      ...(params?.categoriaId ? { categoriaId: params.categoriaId } : {}),
    };

    if (barcode) {
      const produto = await prisma.produto.findFirst({
        where: { ...baseWhere, barcode },
        select: produtoPosSelect,
      });
      return {
        items: produto ? [mapPosProduto(produto as Record<string, unknown>)] : [],
        page: 1,
        pageSize: 1,
        hasMore: false,
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
            ...( /^\d+$/.test(query) ? [{ id: BigInt(query) }] : [] ),
          ],
        }
      : {};

    const where = {
      ...baseWhere,
      ...(query ? queryFilters : {}),
    };

    const items = await prisma.produto.findMany({
      where,
      select: produtoPosSelect,
      orderBy: [{ nomeComercial: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });

    const mapped = items.map((row: any) =>
      mapPosProduto(row as Record<string, unknown>),
    );

    return {
      items: mapped.slice(0, pageSize),
      page,
      pageSize,
      hasMore: items.length > pageSize,
    };
  }
}
