import { buildFefoLoteWhereForPos } from "../../../stock/domain/fefo-lote.service";
import { StockAvailabilityService } from "./stock-availability.service";

type LoteRow = {
  stockBalance?: { quantidadeDisponivel?: unknown } | null;
  dataValidade?: Date;
};

/** Selecção FEFO de lotes vendáveis com stock em cache. */
export class FefoSelectionService {
  constructor(private readonly stock = new StockAvailabilityService()) {}

  buildSellableLoteWhere(now = new Date()) {
    return buildFefoLoteWhereForPos(now);
  }

  selectSellableLotes<T extends LoteRow>(lotes: T[]): T[] {
    return lotes.filter((lote) => this.stock.readLoteAvailable(lote) > 0);
  }

  pickPrimaryLote<T extends LoteRow>(lotes: T[]): T | null {
    const sellable = this.selectSellableLotes(lotes);
    return sellable[0] ?? null;
  }
}
