import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  inventarioItemInclude,
  mapInventarioItem,
} from "./inventory.mapper";

type ListInventoryItemsInput = {
  inventarioId: string;
  query?: string;
  page?: number;
  pageSize?: number;
  nomeGenerico?: string;
  forma?: string;
  fornecedorNome?: string;
};

export class ListInventoryItemsUseCase {
  async execute(input: ListInventoryItemsInput) {
    const prisma = getPrisma();
    const inventarioId = BigInt(input.inventarioId);
    const query = input.query?.trim() || undefined;
    const nomeGenerico = input.nomeGenerico?.trim() || undefined;
    const forma = input.forma?.trim() || undefined;
    const fornecedorNome = input.fornecedorNome?.trim() || undefined;
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));

    const andFilters: any[] = [];
    if (query) {
      andFilters.push({
        OR: [
          { produto: { nomeComercial: { contains: query } } },
          { produto: { nomeGenerico: { contains: query } } },
          { produto: { dosagem: { contains: query } } },
          { produto: { forma: { contains: query } } },
          { produto: { apresentacao: { contains: query } } },
          { lote: { numeroLote: { contains: query } } },
          { lote: { fornecedor: { nome: { contains: query } } } },
        ],
      });
    }
    if (nomeGenerico) {
      andFilters.push({
        produto: { nomeGenerico: { contains: nomeGenerico } },
      });
    }
    if (forma) {
      andFilters.push({
        produto: { forma: { contains: forma } },
      });
    }
    if (fornecedorNome) {
      andFilters.push({
        lote: { fornecedor: { nome: { contains: fornecedorNome } } },
      });
    }

    const where: any = {
      inventarioId,
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    };

    const items = await prisma.inventarioItem.findMany({
      where,
      include: inventarioItemInclude,
      orderBy: [
        { produto: { nomeComercial: "asc" } },
        { lote: { numeroLote: "asc" } },
        { id: "asc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });

    const mapped = items.map(mapInventarioItem);

    return {
      items: mapped.slice(0, pageSize),
      page,
      pageSize,
      hasMore: items.length > pageSize,
    };
  }
}
