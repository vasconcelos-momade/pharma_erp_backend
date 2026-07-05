import { describe, expect, test } from "bun:test";
import {
  resolveProdutoPolicy,
  requiresLivroReceita,
} from "./produto-dispensacao-policy";

describe("resolveProdutoPolicy", () => {
  test("RECEITA_ESPECIAL aplica flags coerentes", () => {
    const policy = resolveProdutoPolicy({ tipoDispensacao: "RECEITA_ESPECIAL" });
    expect(policy.tipoDispensacao).toBe("RECEITA_ESPECIAL");
    expect(policy.requiresPrescription).toBe(true);
    expect(policy.requiresPsychotropicBook).toBe(true);
    expect(policy.requiresDoubleCheck).toBe(true);
  });

  test("mapeia legado NARCOTICO para RECEITA_ESPECIAL", () => {
    const policy = resolveProdutoPolicy({ tipoDispensacao: "NARCOTICO" });
    expect(policy.tipoDispensacao).toBe("RECEITA_ESPECIAL");
    expect(policy.requiresPsychotropicBook).toBe(true);
  });

  test("antimicrobiano eleva OTC para RECEITA_NORMAL", () => {
    const policy = resolveProdutoPolicy({
      tipoDispensacao: "VENDA_LIVRE",
      antimicrobiano: true,
    });
    expect(policy.tipoDispensacao).toBe("RECEITA_NORMAL");
    expect(policy.requiresPrescription).toBe(true);
    expect(policy.requiresPsychotropicBook).toBe(false);
  });

  test("RECEITA_NORMAL exige receita sem livro psicotrópico", () => {
    const policy = resolveProdutoPolicy({ tipoDispensacao: "RECEITA_NORMAL" });
    expect(policy.requiresPrescription).toBe(true);
    expect(policy.requiresPsychotropicBook).toBe(false);
    expect(requiresLivroReceita(policy.tipoDispensacao)).toBe(true);
  });

  test("preserva metadados de classificação", () => {
    const policy = resolveProdutoPolicy({
      tipoDispensacao: "RECEITA_NORMAL",
      classificacaoRule: "receitaNormal",
      classificacaoReason: "teste",
      classificacaoMatchedTerm: "AMOXICILINA",
    });
    expect(policy.classificacaoRule).toBe("receitaNormal");
    expect(policy.tipoDispensacao).toBe("RECEITA_NORMAL");
  });
});
