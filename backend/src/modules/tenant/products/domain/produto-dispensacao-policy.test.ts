import { describe, expect, test } from "bun:test";
import { resolveProdutoPolicy } from "./produto-dispensacao-policy";

describe("resolveProdutoPolicy", () => {
  test("NARCOTICO aplica flags coerentes", () => {
    const policy = resolveProdutoPolicy({ tipoDispensacao: "NARCOTICO" });
    expect(policy.tipoDispensacao).toBe("NARCOTICO");
    expect(policy.requiresPrescription).toBe(true);
    expect(policy.requiresPsychotropicBook).toBe(true);
  });

  test("antimicrobiano eleva OTC para RECEITA_OBRIGATORIA", () => {
    const policy = resolveProdutoPolicy({
      tipoDispensacao: "VENDA_LIVRE",
      antimicrobiano: true,
    });
    expect(policy.tipoDispensacao).toBe("RECEITA_OBRIGATORIA");
    expect(policy.requiresPrescription).toBe(true);
  });

  test("RECEITA_CONTROLADA exige dupla verificacao", () => {
    const policy = resolveProdutoPolicy({ tipoDispensacao: "RECEITA_CONTROLADA" });
    expect(policy.requiresDoubleCheck).toBe(true);
  });

  test("preserva regra de auditoria do seed", () => {
    const policy = resolveProdutoPolicy({
      tipoDispensacao: "RECEITA_SIMPLES",
      requiresPrescription: true,
      classificacaoRule: "receitaSimples",
      classificacaoReason: "teste",
      classificacaoMatchedTerm: "AMOXICILINA",
    });
    expect(policy.classificacaoRule).toBe("receitaSimples");
    expect(policy.tipoDispensacao).toBe("RECEITA_SIMPLES");
  });
});
