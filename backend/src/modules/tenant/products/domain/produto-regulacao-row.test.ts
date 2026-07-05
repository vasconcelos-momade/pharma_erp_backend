import { describe, expect, test } from "bun:test";
import { policyToRegulacaoRow, resolveProdutoPolicy } from "./produto-dispensacao-policy";

describe("policyToRegulacaoRow", () => {
  test("persiste apenas campos legais essenciais", () => {
    const policy = resolveProdutoPolicy({ tipoDispensacao: "PSICOTROPICO" });
    const row = policyToRegulacaoRow(policy);

    expect(row).toEqual({
      tipoDispensacao: "PSICOTROPICO",
      requiresPrescription: true,
      requiresPsychotropicBook: true,
      policyVersion: policy.policyVersion,
    });
    expect(row).not.toHaveProperty("antimicrobiano");
    expect(row).not.toHaveProperty("requiresDoubleCheck");
    expect(row).not.toHaveProperty("requiresManualReview");
    expect(row).not.toHaveProperty("riskLevel");
  });
});
