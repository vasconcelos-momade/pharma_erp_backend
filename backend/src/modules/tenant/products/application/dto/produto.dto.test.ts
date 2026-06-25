import { describe, expect, test } from "bun:test";
import {
  categoriaProdutoSchema,
  createProdutoSchema,
  searchProdutosQuerySchema,
  updateProdutoSchema,
} from "./produto.dto";

describe("produto.dto", () => {
  test("aceita todas as categorias válidas", () => {
    for (const categoria of [
      "MEDICAMENTO",
      "CONSUMIVEL",
      "EQUIPAMENTO",
      "HIGIENE",
      "SUPLEMENTO",
      "OUTRO",
    ] as const) {
      expect(categoriaProdutoSchema.parse(categoria)).toBe(categoria);
    }
  });

  test("rejeita categoria inválida", () => {
    expect(() => categoriaProdutoSchema.parse("INVALIDA")).toThrow();
  });

  test("create aceita categoria opcional", () => {
    const parsed = createProdutoSchema.parse({
      nome: "Sabonete",
      categoria: "HIGIENE",
    });
    expect(parsed.categoria).toBe("HIGIENE");
  });

  test("update aceita apenas categoria", () => {
    const parsed = updateProdutoSchema.parse({ categoria: "OUTRO" });
    expect(parsed.categoria).toBe("OUTRO");
  });

  test("search aceita filtro categoria opcional", () => {
    const parsed = searchProdutosQuerySchema.parse({ categoria: "CONSUMIVEL" });
    expect(parsed.categoria).toBe("CONSUMIVEL");
  });
});
