import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";

export class ListSuppliersUseCase {
  async execute(search?: string) {
    const prisma = getPrisma();
    const normalizedSearch = search?.trim();

    const suppliers = await prisma.fornecedor.findMany({
      where: {
        deletedAt: null,
        ativo: true,
        ...(normalizedSearch
          ? {
              OR: [
                { nome: { contains: normalizedSearch } },
                { nuit: { contains: normalizedSearch } },
                { email: { contains: normalizedSearch } },
                { telefone: { contains: normalizedSearch } },
              ],
            }
          : {}),
      },
      orderBy: { nome: "asc" },
      take: 100,
    });

    return suppliers.map((supplier) => ({
      id: supplier.id.toString(),
      nome: supplier.nome,
      nuit: supplier.nuit,
      telefone: supplier.telefone,
      email: supplier.email,
    }));
  }
}
