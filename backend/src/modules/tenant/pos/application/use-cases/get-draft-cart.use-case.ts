import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { draftCartService } from "../services/draft-cart.service";
import type { DraftCartMutationContext, DraftCartView } from "../services/draft-cart.types";

type GetDraftCartParams = DraftCartMutationContext & {
  valorRecebido?: number | null;
};

export class GetDraftCartUseCase {
  async execute(ctx: GetDraftCartParams): Promise<DraftCartView> {
    const prisma = getPrisma();
    await draftCartService.assertCaixaAberta(prisma, ctx.userId);

    const fatura = await prisma.fatura.findUnique({
      where: { idempotencyKey: ctx.idempotencyKey },
      select: { id: true, estado: true },
    });

    if (!fatura || fatura.estado !== "RASCUNHO") {
      return draftCartService.emptyCartView(ctx.idempotencyKey, ctx.valorRecebido);
    }

    return draftCartService.buildCartView(prisma, fatura.id, ctx.valorRecebido);
  }
}
