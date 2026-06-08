import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { mapInventarioResumo } from "./inventory.mapper";

type ListInventoriesInput = {
  status?: "ABERTO" | "EM_CONTAGEM" | "RECONCILIADO" | "CANCELADO";
};

export class ListInventoriesUseCase {
  async execute(input: ListInventoriesInput = {}) {
    const prisma = getPrisma();

    const inventarios = await prisma.inventario.findMany({
      where: input.status ? { status: input.status } : undefined,
      include: {
        iniciadoPor: { select: { id: true, name: true } },
        reconciliadoPor: { select: { id: true, name: true } },
        _count: { select: { itens: true } },
      },
      orderBy: { iniciadoEm: "desc" },
    });

    return inventarios.map(mapInventarioResumo);
  }
}
