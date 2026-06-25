import { describe, expect, test } from "bun:test";
import { extractCatalogData } from "./produto-catalog";

describe("extractCatalogData", () => {
  test("inclui categoriaId quando presente no payload", () => {
    const result = extractCatalogData({
      nome: "Seringa 5ml",
      categoriaId: "7",
      tipoDispensacao: "VENDA_LIVRE",
    });

    expect(result).toEqual({
      nome: "Seringa 5ml",
      categoriaId: "7",
    });
  });

  test("omite categoriaId quando ausente", () => {
    const result = extractCatalogData({
      nome: "Paracetamol",
    });

    expect(result).toEqual({ nome: "Paracetamol" });
    expect(result).not.toHaveProperty("categoriaId");
  });
});
