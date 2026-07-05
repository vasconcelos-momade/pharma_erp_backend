import { describe, expect, test } from "bun:test";
import { buildFefoLoteWhereForPos } from "../../../stock/domain/fefo-lote.service";
import { produtoPosStockWhere } from "../../../products/domain/produto-presenter";

describe("PDV stock-first catalog filters", () => {
  test("buildFefoLoteWhereForPos exige lote válido com stock", () => {
    const now = new Date("2026-07-05T12:00:00.000Z");
    const where = buildFefoLoteWhereForPos(now);

    expect(where.ativo).toBe(true);
    expect(where.deletedAt).toBeNull();
    expect(where.estadoSanitario).toBe("VALIDO");
    expect(where.disponibilidade).toBe("DISPONIVEL");
    expect(where.dataValidade).toEqual({ gte: now });
    expect(where.stockBalance).toEqual({ quantidadeDisponivel: { gt: 0 } });
  });

  test("produtoPosStockWhere combina StockBalance e lote FEFO", () => {
    expect(produtoPosStockWhere.stockBalance).toEqual({
      quantidadeDisponivel: { gt: 0 },
    });
    expect(produtoPosStockWhere.lotes.some).toBeDefined();
    expect((produtoPosStockWhere.lotes.some as Record<string, unknown>).ativo).toBe(true);
  });
});
