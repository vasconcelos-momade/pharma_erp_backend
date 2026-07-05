import { describe, expect, test } from "bun:test";
import { policyToRegulacaoRow, resolveProdutoPolicy } from "./produto-dispensacao-policy";

describe("policyToRegulacaoRow", () => {
  test("persiste apenas campos legais derivados", () => {
    const policy = resolveProdutoPolicy({ tipoDispensacao: "RECEITA_ESPECIAL" });
    expect(policyToRegulacaoRow(policy)).toEqual({
      tipoDispensacao: "RECEITA_ESPECIAL",
      requiresPrescription: true,
      requiresPsychotropicBook: true,
      policyVersion: 3,
    });
  });
});
