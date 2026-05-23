import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { mapPosProduto, produtoPosSelect } from "../../../products/domain/produto-presenter";

export class SearchProdutosUseCase {
  async execute(params?: {
    query?: string;
    barcode?: string;
    page?: number;
    pageSize?: number;
  }) {
    const prisma = getPrisma();
    const query = params?.query?.trim() || undefined;
    const barcode = params?.barcode?.trim() || undefined;
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 20));

    if (barcode) {
      const produto = await prisma.produto.findUnique({
        where: { barcode, ativo: true },
        select: produtoPosSelect,
      });
      return {
        items: produto ? [mapPosProduto(produto as Record<string, unknown>)] : [],
        page: 1,
        pageSize: 1,
        hasMore: false,
      };
    }

    const where = {
      ativo: true,
      ...(query
        ? {
            OR: [
              { nome: { contains: query } },
              { substanciaActiva: { contains: query } },
              { barcode: { contains: query } },
            ],
          }
        : {}),
    };

    const items = await prisma.produto.findMany({
      where,
      select: produtoPosSelect,
      orderBy: [{ nome: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });

    const mapped = items.map((row) => mapPosProduto(row as Record<string, unknown>));

    return {
      items: mapped.slice(0, pageSize),
      page,
      pageSize,
      hasMore: items.length > pageSize,
    };
  }
}
