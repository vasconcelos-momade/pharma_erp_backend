import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import type { RecordInventoryCountDTO } from "../../dto/inventory.dto";
import { inventarioItemInclude, mapInventarioItem } from "./inventory.mapper";

export class RecordInventoryCountUseCase {
  async execute(inventarioId: string, itemId: string, data: RecordInventoryCountDTO) {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx: any) => {
      const invId = BigInt(inventarioId);
      const itId = BigInt(itemId);

      await tx.$executeRaw`SELECT id FROM inventarios WHERE id = ${invId} FOR UPDATE`;

      const inventario = await tx.inventario.findUnique({ where: { id: invId } });
      if (!inventario) {
        throw new Error("Inventário não encontrado");
      }

      if (inventario.status !== "EM_CONTAGEM") {
        throw new Error("A contagem só pode ser registada com o inventário em contagem");
      }

      const item = await tx.inventarioItem.findFirst({
        where: { id: itId, inventarioId: invId },
      });

      if (!item) {
        throw new Error("Item de inventário não encontrado");
      }

      const estoqueSistema = Number(item.estoqueSistema);
      const estoqueContado = data.estoqueContado;
      const divergencia = estoqueContado - estoqueSistema;

      const updated = await tx.inventarioItem.update({
        where: { id: itId },
        data: {
          estoqueContado,
          divergencia,
        },
        include: inventarioItemInclude,
      });

      return mapInventarioItem(updated);
    });
  }
}
