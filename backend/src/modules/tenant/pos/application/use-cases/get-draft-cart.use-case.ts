import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { draftCartService } from "../services/draft-cart.service";
import type { DraftCartMutationContext, DraftCartView } from "../services/draft-cart.types";

type GetDraftCartParams = DraftCartMutationContext & {
  valorRecebido?: number | null;
};

export class GetDraftCartUseCase {
  async execute(ctx: GetDraftCartParams): Promise<DraftCartView> {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx: any) => {
      await draftCartService.assertCaixaAberta(tx, ctx.userId);

      const activeKey = await draftCartService.ensureActiveCartKey(tx, ctx);
      const activeCtx = { ...ctx, idempotencyKey: activeKey };

      const fatura = await draftCartService.resolveActiveDraftFatura(
        tx,
        activeCtx.userId,
        activeKey,
      );

      if (!fatura) {
        return draftCartService.emptyCartView(activeKey, ctx.valorRecebido);
      }

      return draftCartService.buildCartView(tx, fatura.id, ctx.valorRecebido);
    });
  }
}
