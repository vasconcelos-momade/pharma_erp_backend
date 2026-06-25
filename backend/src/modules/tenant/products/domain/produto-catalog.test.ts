import { describe, expect, test } from "bun:test";
import { extractCatalogData } from "./produto-catalog";

describe("extractCatalogData", () => {
  test("inclui categoria quando presente no payload", () => {
    const result = extractCatalogData({
      nome: "Seringa 5ml",
      categoria: "CONSUMIVEL",
      tipoDispensacao: "VENDA_LIVRE",
    });

    expect(result).toEqual({
      nome: "Seringa 5ml",
      categoria: "CONSUMIVEL",
    });
  });

  test("omite categoria quando ausente (default MEDICAMENTO no banco)", () => {
    const result = extractCatalogData({
      nome: "Paracetamol",
    });

    expect(result).toEqual({ nome: "Paracetamol" });
    expect(result).not.toHaveProperty("categoria");
  });
});
