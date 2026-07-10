import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import type { OpenInventoryDTO } from "../../dto/inventory.dto";
import { generateInventarioCodigo } from "./inventory-code.service";
import { inventarioItemInclude, mapInventarioDetalhe } from "./inventory.mapper";

export class OpenInventoryUseCase {
  async execute(data: OpenInventoryDTO & { userId: string }) {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx: any) => {
      const codigo = await generateInventarioCodigo(tx);

      const lotes = await tx.lote.findMany({
        where: {
          deletedAt: null,
          ativo: true,
          stockBalance: { quantidadeTotal: { gt: 0 } },
          movimentos: { some: { deletedAt: null } },
        },
        select: {
          id: true,
          produtoId: true,
          stockBalance: { select: { quantidadeTotal: true } },
        },
        orderBy: [{ produtoId: "asc" }, { id: "asc" }],
      });

      const inventario = await tx.inventario.create({
        data: {
          codigo,
          observacao: data.observacao?.trim() || null,
          status: "ABERTO",
          iniciadoPorId: BigInt(data.userId),
          itens: {
            create: lotes.map((lote: { id: bigint; produtoId: bigint; stockBalance?: { quantidadeTotal?: unknown } | null }) => {
              const qty = Number(lote.stockBalance?.quantidadeTotal ?? 0);
              return {
                produtoId: lote.produtoId,
                loteId: lote.id,
                estoqueSistema: qty,
                estoqueContado: qty,
                divergencia: 0,
              };
            }),
          },
        },
        include: {
          iniciadoPor: { select: { id: true, name: true } },
          itens: {
            include: inventarioItemInclude,
            orderBy: [{ produtoId: "asc" }, { loteId: "asc" }],
          },
        },
      });

      return mapInventarioDetalhe(inventario);
    });
  }
}
