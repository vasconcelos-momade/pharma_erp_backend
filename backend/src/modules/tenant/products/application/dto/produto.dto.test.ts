import { describe, expect, test } from "bun:test";
import {
  categoriaIdSchema,
  createProdutoSchema,
  searchProdutosQuerySchema,
  updateProdutoSchema,
} from "./produto.dto";

describe("produto.dto", () => {
  test("create exige nomeComercial, categoriaId e tipoDispensacao", () => {
    const parsed = createProdutoSchema.parse({
      nomeComercial: "Sabonete",
      categoriaId: "12",
      tipoDispensacao: "VENDA_LIVRE",
    });
    expect(parsed.categoriaId).toBe("12");
    expect(parsed.tipoDispensacao).toBe("VENDA_LIVRE");
  });

  test("create aceita taxRuleId e campos opcionais", () => {
    const parsed = createProdutoSchema.parse({
      nomeComercial: "Sabonete",
      categoriaId: "12",
      tipoDispensacao: "RECEITA_NORMAL",
      taxRuleId: "2",
      estoqueMinimo: 5,
    });
    expect(parsed.taxRuleId).toBe("2");
    expect(parsed.estoqueMinimo).toBe(5);
  });

  test("update aceita apenas categoriaId", () => {
    const parsed = updateProdutoSchema.parse({ categoriaId: "45" });
    expect(parsed.categoriaId).toBe("45");
  });

  test("search aceita filtro categoriaId opcional", () => {
    const parsed = searchProdutosQuerySchema.parse({ categoriaId: "9" });
    expect(parsed.categoriaId).toBe("9");
  });

  test("search interpreta ativo=false correctamente", () => {
    const parsed = searchProdutosQuerySchema.parse({ ativo: "false" });
    expect(parsed.ativo).toBe(false);
  });

  test("search interpreta includeInactive=true correctamente", () => {
    const parsed = searchProdutosQuerySchema.parse({ includeInactive: "true" });
    expect(parsed.includeInactive).toBe(true);
  });

  test("search preserva alias categoria para o controller", () => {
    const parsed = searchProdutosQuerySchema.parse({ categoria: "9" });
    expect(parsed.categoria).toBe("9");
  });

  test("schema de categoriaId rejeita valor inválido", () => {
    expect(() => categoriaIdSchema.parse("abc")).toThrow();
  });
});
