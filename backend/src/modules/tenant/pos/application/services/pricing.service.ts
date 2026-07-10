import { resolveLotePrecoVenda } from "../../../stock/domain/fefo-lote.service";

type LotePrecoRow = {
  precoVenda?: unknown | null;
  numeroLote?: string;
};

/** Resolução de preço de venda a partir do lote FEFO (fonte: Lote.precoVenda). */
export class PricingService {
  resolveSalePrice(
    lote: LotePrecoRow | null,
    productName?: string,
  ): number {
    if (!lote?.precoVenda) {
      return 0;
    }
    try {
      return resolveLotePrecoVenda(lote, productName);
    } catch {
      return 0;
    }
  }
}
