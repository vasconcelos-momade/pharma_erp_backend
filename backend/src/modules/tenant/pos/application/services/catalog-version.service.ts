import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";

export type TenantCatalogVersion = {
  catalogVersion: string;
  productCount: number;
  maxUpdatedAt: string;
};

/** Versão leve do catálogo POS (invalidação de cache no cliente). */
export async function getTenantCatalogVersion(): Promise<TenantCatalogVersion> {
  const prisma = getPrisma();
  const aggregate = await prisma.produto.aggregate({
    where: {
      ativo: true,
      deletedAt: null,
    },
    _count: { id: true },
    _max: { updatedAt: true },
  });

  const productCount = aggregate._count.id;
  const maxUpdatedAt = aggregate._max.updatedAt ?? new Date(0);

  return {
    catalogVersion: `${maxUpdatedAt.toISOString()}-${productCount}`,
    productCount,
    maxUpdatedAt: maxUpdatedAt.toISOString(),
  };
}
