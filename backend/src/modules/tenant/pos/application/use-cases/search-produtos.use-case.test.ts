import { describe, expect, test } from "bun:test";
import { buildFefoLoteWhereForPos, buildFefoLoteWhereForPosCandidates } from "../../../stock/domain/fefo-lote.service";
import { POS_DEFAULT_PAGE_SIZE } from "../../domain/pos-catalog.constants";
import { posProductCandidateWhere, posProductStockWhere } from "../../domain/pos-catalog.query";
import { FefoSelectionService } from "../services/fefo-selection.service";
import { PosProductMapper } from "../services/pos-product.mapper";
import { PricingService } from "../services/pricing.service";
import { ProductSearchService } from "../services/product-search.service";
import { StockAvailabilityService } from "../services/stock-availability.service";

describe("PDV stock-first catalog filters", () => {
  test("buildFefoLoteWhereForPos considera o dia todo para a validade", () => {
    const now = new Date("2026-07-05T12:00:00.000Z");
    const where = buildFefoLoteWhereForPos(now);

    expect(where.ativo).toBe(true);
    expect(where.deletedAt).toBeNull();
    expect(where.estadoSanitario).toBe("VALIDO");
    expect(where.disponibilidade).toBe("DISPONIVEL");
    expect(where.dataValidade).toEqual({
      gte: new Date("2026-07-05T00:00:00.000Z"),
    });
    expect(where.stockBalance).toEqual({ quantidadeDisponivel: { gt: 0 } });
  });

  test("buildFefoLoteWhereForPosCandidates não exige cache de stock", () => {
    const where = buildFefoLoteWhereForPosCandidates(new Date("2026-07-05T12:00:00.000Z"));
    expect(where.stockBalance).toBeUndefined();
    expect(where.dataValidade).toEqual({
      gte: new Date("2026-07-05T00:00:00.000Z"),
    });
  });

  test("posProductCandidateWhere inclui lotes FEFO candidatos", () => {
    expect(posProductCandidateWhere.lotes.some).toBeDefined();
    expect(
      (posProductCandidateWhere.lotes.some as Record<string, unknown>).ativo,
    ).toBe(true);
  });

  test("posProductStockWhere combina StockBalance e lote FEFO", () => {
    expect(posProductStockWhere.stockBalance).toEqual({
      quantidadeDisponivel: { gt: 0 },
    });
    expect(posProductStockWhere.lotes.some).toBeDefined();
    expect(
      (posProductStockWhere.lotes.some as Record<string, unknown>).ativo,
    ).toBe(true);
  });
});

describe("POS catalog services", () => {
  test("ProductSearchService usa pageSize 10 por defeito", () => {
    const service = new ProductSearchService();
    expect(service.normalizePagination()).toEqual({
      page: 1,
      pageSize: POS_DEFAULT_PAGE_SIZE,
    });
  });

  test("StockAvailabilityService lê stock do cache", () => {
    const service = new StockAvailabilityService();
    expect(
      service.readProductAvailable({
        stockBalance: { quantidadeDisponivel: 12 },
      }),
    ).toBe(12);
    expect(
      service.hasSellableStock({
        stockBalance: { quantidadeDisponivel: 5 },
        lotes: [{ stockBalance: { quantidadeDisponivel: 2 } }],
      }),
    ).toBe(true);
    expect(
      service.hasSellableStock({
        stockBalance: { quantidadeDisponivel: 0 },
        lotes: [{ stockBalance: { quantidadeDisponivel: 2 } }],
      }),
    ).toBe(true);
  });

  test("FefoSelectionService escolhe o primeiro lote vendável", () => {
    const service = new FefoSelectionService();
    const lotes = [
      { numeroLote: "A", stockBalance: { quantidadeDisponivel: 0 } },
      { numeroLote: "B", stockBalance: { quantidadeDisponivel: 3 } },
    ];
    expect(service.pickPrimaryLote(lotes)?.numeroLote).toBe("B");
  });

  test("PricingService resolve preço do lote FEFO", () => {
    const service = new PricingService();
    expect(
      service.resolveSalePrice({ precoVenda: 150, numeroLote: "L1" }, "Paracetamol"),
    ).toBe(150);
    expect(service.resolveSalePrice(null)).toBe(0);
  });

  test("PosProductMapper projeta produto vendável para API", () => {
    const mapper = new PosProductMapper();
    const validade = new Date("2027-01-01T00:00:00.000Z");
    const api = mapper.fromProdutoRow({
      id: 1n,
      nomeComercial: "Paracetamol 500mg",
      nomeGenerico: "Paracetamol",
      barcode: "12345678",
      categoriaId: 2n,
      categoria: {
        id: 2n,
        nome: "Analgésicos",
        codigoFNM: null,
        descricao: null,
        ativo: true,
      },
      dosagem: "500mg",
      forma: "Comprimido",
      apresentacao: "Caixa",
      ativo: true,
      taxRule: null,
      regulacao: {
        tipoDispensacao: "VENDA_LIVRE",
        requiresPrescription: false,
        requiresPsychotropicBook: false,
      },
      stockBalance: { quantidadeDisponivel: 10 },
      lotes: [
        {
          id: 9n,
          numeroLote: "L2026",
          dataValidade: validade,
          precoVenda: 75,
          stockBalance: { quantidadeDisponivel: 10 },
        },
      ],
    });

    expect(api).not.toBeNull();
    expect(api?.estoqueAtual).toBe(10);
    expect(api?.precoVenda).toBe(75);
    expect(api?.lote).toBe("L2026");
    expect(api?.dataValidade).toBe(validade.toISOString());
    expect(api?.tipoDispensacao).toBe("VENDA_LIVRE");
  });
});
