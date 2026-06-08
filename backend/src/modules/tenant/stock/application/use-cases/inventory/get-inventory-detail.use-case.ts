import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { inventarioItemInclude, mapInventarioDetalhe } from "./inventory.mapper";

export class GetInventoryDetailUseCase {
  async execute(inventarioId: string) {
    const prisma = getPrisma();

    const inventario = await prisma.inventario.findUnique({
      where: { id: BigInt(inventarioId) },
      include: {
        iniciadoPor: { select: { id: true, name: true } },
        reconciliadoPor: { select: { id: true, name: true } },
        itens: {
          include: inventarioItemInclude,
          orderBy: [{ produtoId: "asc" }, { loteId: "asc" }],
        },
      },
    });

    if (!inventario) {
      throw new Error("Inventário não encontrado");
    }

    return mapInventarioDetalhe(inventario);
  }
}
