import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import type { CategoriaProdutoValue } from "../../../../products/application/dto/produto.dto";
import {
  mapRequisicaoProduto,
  produtoRequisicaoSelect,
} from "../../../../products/domain/produto-presenter";

export class SearchRequisitionProdutosUseCase {
  async execute(params?: {
    q?: string;
    categoria?: CategoriaProdutoValue;
    page?: number;
    pageSize?: number;
  }) {
    const prisma = getPrisma();
    const searchTerm = params?.q?.trim() || undefined;
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 20));

    const baseWhere = {
      ativo: true,
      deletedAt: null,
      ...(params?.categoria ? { categoria: params.categoria } : {}),
    };

    const queryFilters = searchTerm
      ? {
          OR: [
            { nome: { contains: searchTerm } },
            { substanciaActiva: { contains: searchTerm } },
            { barcode: { contains: searchTerm } },
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
      select: produtoRequisicaoSelect,
      orderBy: [{ nome: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });

    const mapped = items.map((row) =>
      mapRequisicaoProduto(row as Record<string, unknown>),
    );

    return {
      items: mapped.slice(0, pageSize),
      page,
      pageSize,
      hasMore: items.length > pageSize,
    };
  }
}
