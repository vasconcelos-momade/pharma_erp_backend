import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { draftCartService } from "../services/draft-cart.service";
import type {
  DraftCartItemInput,
  DraftCartMutationContext,
  DraftCartView,
} from "../services/draft-cart.types";

export class AddDraftCartItemUseCase {
  async execute(
    ctx: DraftCartMutationContext,
    item: DraftCartItemInput,
  ): Promise<DraftCartView> {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx: any) => {
      const fatura = await draftCartService.resolveOrCreateFatura(tx, ctx);
      const activeCtx = { ...ctx, idempotencyKey: fatura.idempotencyKey };
      await draftCartService.addCartItemDelta(tx, fatura.id, activeCtx, {
        ...item,
        quantidade: item.quantidade > 0 ? item.quantidade : 1,
      });
      await draftCartService.recalculateFaturaTotals(tx, fatura.id);
      return draftCartService.buildCartView(tx, fatura.id);
    });
  }
}
