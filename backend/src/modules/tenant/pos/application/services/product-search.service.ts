import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  POS_DEFAULT_PAGE_SIZE,
  POS_MAX_PAGE_SIZE,
} from "../../domain/pos-catalog.constants";
import {
  posProductCandidateWhere,
  posProductSelect,
} from "../../domain/pos-catalog.query";
import type { PosProductMapper } from "./pos-product.mapper";

export type ProductSearchParams = {
  query?: string;
  barcode?: string;
  categoriaId?: bigint;
  page?: number;
  pageSize?: number;
};

export type ProductSearchPage = {
  items: Record<string, unknown>[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalCount: number;
};

const baseProductWhere = {
  ativo: true,
  deletedAt: null,
  ...posProductCandidateWhere,
} as const;

const CANDIDATE_BATCH_SIZE = 50;

export class ProductSearchService {
  normalizePagination(page?: number, pageSize?: number) {
    const safePage = Math.max(1, page ?? 1);
    const safePageSize = Math.min(
      POS_MAX_PAGE_SIZE,
      Math.max(1, pageSize ?? POS_DEFAULT_PAGE_SIZE),
    );
    return { page: safePage, pageSize: safePageSize };
  }

  buildTextQueryFilters(query: string) {
    return {
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
        ...(/^\d+$/.test(query) ? [{ id: BigInt(query) }] : []),
      ],
    };
  }

  buildWhere(params: ProductSearchParams) {
    return {
      ...baseProductWhere,
      ...(params.categoriaId ? { categoriaId: params.categoriaId } : {}),
      ...(params.query?.trim()
        ? this.buildTextQueryFilters(params.query.trim())
        : {}),
    };
  }

  async search(
    params: ProductSearchParams,
    mapper: PosProductMapper,
  ): Promise<ProductSearchPage> {
    const prisma = getPrisma() as any;
    const { page, pageSize } = this.normalizePagination(
      params.page,
      params.pageSize,
    );
    const where = this.buildWhere(params);
    const targetStart = (page - 1) * pageSize;

    const pageItems: Record<string, unknown>[] = [];
    let sellableCount = 0;
    let skip = 0;

    while (true) {
      const batch = await prisma.produto.findMany({
        where,
        select: posProductSelect,
        orderBy: [{ nomeComercial: "asc" }, { id: "asc" }],
        skip,
        take: CANDIDATE_BATCH_SIZE,
      });

      if (!batch.length) {
        break;
      }

      for (const row of batch) {
        const mapped = await mapper.fromProdutoRowAsync(prisma, row);
        if (!mapped) {
          continue;
        }

        if (
          sellableCount >= targetStart &&
          pageItems.length < pageSize
        ) {
          pageItems.push(mapped);
        }

        sellableCount++;
      }

      if (batch.length < CANDIDATE_BATCH_SIZE) {
        break;
      }

      skip += CANDIDATE_BATCH_SIZE;
    }

    return {
      items: pageItems,
      page,
      pageSize,
      totalCount: sellableCount,
      hasMore: page * pageSize < sellableCount,
    };
  }

  async findByBarcode(
    barcode: string,
    mapper: PosProductMapper,
  ): Promise<Record<string, unknown> | null> {
    const prisma = getPrisma() as any;
    const trimmed = barcode.trim();
    if (!trimmed) {
      return null;
    }

    const row = await prisma.produto.findFirst({
      where: {
        ...baseProductWhere,
        barcode: trimmed,
      },
      select: posProductSelect,
    });

    if (!row) {
      return null;
    }

    return mapper.fromProdutoRowAsync(prisma, row);
  }
}
