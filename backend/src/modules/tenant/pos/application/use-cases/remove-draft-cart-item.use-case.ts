import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { draftCartService } from "../services/draft-cart.service";
import type { DraftCartMutationContext, DraftCartView } from "../services/draft-cart.types";

export class RemoveDraftCartItemUseCase {
  async execute(
    ctx: DraftCartMutationContext,
    itemId: string,
  ): Promise<DraftCartView> {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx: any) => {
      const fatura = await prisma.fatura.findUnique({
        where: { idempotencyKey: ctx.idempotencyKey },
        select: { id: true, estado: true },
      });

      if (!fatura || fatura.estado !== "RASCUNHO") {
        throw new Error("Carrinho rascunho não encontrado.");
      }

      const item = await draftCartService.getFaturaItemOrThrow(tx, fatura.id, itemId);
      await draftCartService.deleteItem(tx, item, ctx);
      await draftCartService.recalculateFaturaTotals(tx, fatura.id);
      return draftCartService.buildCartView(tx, fatura.id);
    });
  }
}
