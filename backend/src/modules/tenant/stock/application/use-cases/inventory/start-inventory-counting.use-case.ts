import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { inventarioItemInclude, mapInventarioDetalhe } from "./inventory.mapper";

export class StartInventoryCountingUseCase {
  async execute(inventarioId: string) {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx: any) => {
      const id = BigInt(inventarioId);
      await tx.$executeRaw`SELECT id FROM inventarios WHERE id = ${id} FOR UPDATE`;

      const inventario = await tx.inventario.findUnique({ where: { id } });
      if (!inventario) {
        throw new Error("Inventário não encontrado");
      }

      if (inventario.status !== "ABERTO") {
        throw new Error("Apenas inventários abertos podem iniciar contagem");
      }

      const updated = await tx.inventario.update({
        where: { id },
        data: { status: "EM_CONTAGEM" },
        include: {
          iniciadoPor: { select: { id: true, name: true } },
          reconciliadoPor: { select: { id: true, name: true } },
          itens: {
            include: inventarioItemInclude,
            orderBy: [{ produtoId: "asc" }, { loteId: "asc" }],
          },
        },
      });

      return mapInventarioDetalhe(updated);
    });
  }
}
