import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { draftCartService } from "../services/draft-cart.service";
import type { DraftCartMutationContext, DraftCartView } from "../services/draft-cart.types";

export class GetDraftCartUseCase {
  async execute(ctx: DraftCartMutationContext): Promise<DraftCartView> {
    const prisma = getPrisma();
    await draftCartService.assertCaixaAberta(prisma, ctx.userId);

    const fatura = await prisma.fatura.findUnique({
      where: { idempotencyKey: ctx.idempotencyKey },
      select: { id: true, estado: true },
    });

    if (!fatura || fatura.estado !== "RASCUNHO") {
      return {
        id: "",
        numero: "",
        estado: "RASCUNHO",
        idempotencyKey: ctx.idempotencyKey,
        subtotal: 0,
        desconto: 0,
        ivaTotal: 0,
        total: 0,
        items: [],
      };
    }

    return draftCartService.buildCartView(prisma, fatura.id);
  }
}
