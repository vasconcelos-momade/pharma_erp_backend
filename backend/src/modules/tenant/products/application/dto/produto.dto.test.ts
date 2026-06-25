import { describe, expect, test } from "bun:test";
import {
  categoriaIdSchema,
  createProdutoSchema,
  searchProdutosQuerySchema,
  updateProdutoSchema,
} from "./produto.dto";

describe("produto.dto", () => {
  test("create mantém campos extra para compatibilidade transitória", () => {
    const parsed = createProdutoSchema.parse({
      nome: "Sabonete",
      categoria: "MEDICAMENTO",
    });
    expect(parsed.categoria).toBe("MEDICAMENTO");
  });

  test("create aceita apenas categoriaId", () => {
    const parsed = createProdutoSchema.parse({
      nome: "Sabonete",
      categoriaId: "12",
    });
    expect(parsed.categoriaId).toBe("12");
  });

  test("update aceita apenas categoriaId", () => {
    const parsed = updateProdutoSchema.parse({ categoriaId: "45" });
    expect(parsed.categoriaId).toBe("45");
  });

  test("search aceita filtro categoriaId opcional", () => {
    const parsed = searchProdutosQuerySchema.parse({ categoriaId: "9" });
    expect(parsed.categoriaId).toBe("9");
  });

  test("search ignora categoria legada fora do contrato", () => {
    const parsed = searchProdutosQuerySchema.parse({
      categoria: "MEDICAMENTO",
    });
    expect("categoria" in parsed).toBe(false);
  });

  test("schema de categoriaId rejeita valor inválido", () => {
    expect(() => categoriaIdSchema.parse("abc")).toThrow();
  });
});
