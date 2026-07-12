import { toNumber } from "../../dashboard/application/dashboard-date.util";

type PurchaseMovementRow = {
  quantidade: unknown;
  lote?: { precoCompra: unknown } | null;
};

export function sumPurchaseMovementCost(rows: PurchaseMovementRow[]): number {
  return rows.reduce((sum, row) => {
    const qty = toNumber(row.quantidade);
    const preco = toNumber(row.lote?.precoCompra);
    return sum + qty * preco;
  }, 0);
}
