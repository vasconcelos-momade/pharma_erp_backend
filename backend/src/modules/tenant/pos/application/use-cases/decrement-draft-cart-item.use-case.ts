import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { draftCartService } from "../services/draft-cart.service";
import type { DraftCartMutationContext, DraftCartView } from "../services/draft-cart.types";

export class DecrementDraftCartItemUseCase {
  async execute(
    ctx: DraftCartMutationContext,
    itemId: string,
  ): Promise<DraftCartView> {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx: any) => {
      const fatura = await draftCartService.resolveDraftFaturaOrThrow(tx, ctx);
      const activeCtx = { ...ctx, idempotencyKey: fatura.idempotencyKey ?? ctx.idempotencyKey };
      const item = await draftCartService.getFaturaItemOrThrow(tx, fatura.id, itemId);

      await draftCartService.decrementLineDelta(tx, item, activeCtx);

      await draftCartService.recalculateFaturaTotals(tx, fatura.id);
      return draftCartService.buildCartView(tx, fatura.id);
    });
  }
}
