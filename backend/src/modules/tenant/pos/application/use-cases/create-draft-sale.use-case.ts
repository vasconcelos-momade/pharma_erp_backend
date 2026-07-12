import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { draftCartService } from "../services/draft-cart.service";
import type { DraftCartMutationContext } from "../services/draft-cart.types";

export interface CreateDraftSaleDTO {
  clienteId?: string;
  terminalId?: string;
  userId: string;
  idempotencyKey?: string;
  items: {
    produtoId: string;
    loteId?: string;
    quantidade: number;
    precoUnit?: number;
  }[];
}

/** Compatibilidade: adiciona vários itens ao rascunho numa única transação. */
export class CreateDraftSaleUseCase {
  async execute(data: CreateDraftSaleDTO) {
    if (!data.idempotencyKey) {
      throw new Error("idempotencyKey é obrigatório para o carrinho PDV.");
    }

    const ctx: DraftCartMutationContext = {
      userId: data.userId,
      idempotencyKey: data.idempotencyKey,
      clienteId: data.clienteId,
      terminalId: data.terminalId,
    };

    const prisma = getPrisma();

    return prisma.$transaction(async (tx: any) => {
      const fatura = await draftCartService.resolveOrCreateFatura(tx, ctx);
      const activeCtx = { ...ctx, idempotencyKey: fatura.idempotencyKey };

      for (const item of data.items) {
        await draftCartService.addCartItemDelta(tx, fatura.id, activeCtx, item);
      }

      await draftCartService.recalculateFaturaTotals(tx, fatura.id);
      return draftCartService.buildCartView(tx, fatura.id);
    });
  }
}
