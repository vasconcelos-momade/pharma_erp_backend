import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";

export class SearchServicosUseCase {
  async execute(query?: string) {
    const prisma = getPrisma();

    return await prisma.servico.findMany({
      where: {
        ativo: true,
        nome: { contains: query || "" }
      },
      select: {
        id: true,
        nome: true,
        preco: true,
        tipoServicoClinico: true
      },
      take: 10
    });
  }
}
