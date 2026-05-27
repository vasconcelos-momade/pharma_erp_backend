/**
 * Política de dispensação unificada (expand-contract).
 * Fonte: `tipoDispensacao` + flags; sem `classificacaoAnarme`.
 */

export const PRODUTO_POLICY_VERSION = 2;

export type TipoDispensacao =
  | "VENDA_LIVRE"
  | "RECEITA_SIMPLES"
  | "RECEITA_CONTROLADA"
  | "RECEITA_OBRIGATORIA"
  | "RECEITA_RETIDA"
  | "PSICOTROPICO"
  | "NARCOTICO";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ProdutoPolicyInput = {
  tipoDispensacao?: TipoDispensacao | string | null;
  antimicrobiano?: boolean | null;
  requiresPrescription?: boolean | null;
  requiresDoubleCheck?: boolean | null;
  requiresPsychotropicBook?: boolean | null;
  requiresManualReview?: boolean | null;
  riskLevel?: RiskLevel | string | null;
  classificacaoRule?: string | null;
  classificacaoReason?: string | null;
  classificacaoMatchedTerm?: string | null;
};

export type ResolvedProdutoPolicy = {
  antimicrobiano: boolean;
  tipoDispensacao: TipoDispensacao;
  requiresPrescription: boolean;
  requiresDoubleCheck: boolean;
  requiresPsychotropicBook: boolean;
  requiresManualReview: boolean;
  riskLevel: RiskLevel;
  policyVersion: number;
  classificacaoRule: string | null;
  classificacaoReason: string | null;
  classificacaoMatchedTerm: string | null;
};

const DISPENSACAO_DEFAULTS: Record<
  TipoDispensacao,
  Omit<
    ResolvedProdutoPolicy,
    | "antimicrobiano"
    | "tipoDispensacao"
    | "classificacaoRule"
    | "classificacaoReason"
    | "classificacaoMatchedTerm"
    | "policyVersion"
  >
> = {
  VENDA_LIVRE: {
    requiresPrescription: false,
    requiresDoubleCheck: false,
    requiresPsychotropicBook: false,
    requiresManualReview: false,
    riskLevel: "LOW",
  },
  RECEITA_SIMPLES: {
    requiresPrescription: true,
    requiresDoubleCheck: false,
    requiresPsychotropicBook: false,
    requiresManualReview: false,
    riskLevel: "MEDIUM",
  },
  RECEITA_CONTROLADA: {
    requiresPrescription: true,
    requiresDoubleCheck: true,
    requiresPsychotropicBook: false,
    requiresManualReview: false,
    riskLevel: "HIGH",
  },
  RECEITA_OBRIGATORIA: {
    requiresPrescription: true,
    requiresDoubleCheck: false,
    requiresPsychotropicBook: false,
    requiresManualReview: false,
    riskLevel: "MEDIUM",
  },
  RECEITA_RETIDA: {
    requiresPrescription: true,
    requiresDoubleCheck: true,
    requiresPsychotropicBook: false,
    requiresManualReview: false,
    riskLevel: "HIGH",
  },
  PSICOTROPICO: {
    requiresPrescription: true,
    requiresDoubleCheck: true,
    requiresPsychotropicBook: true,
    requiresManualReview: false,
    riskLevel: "HIGH",
  },
  NARCOTICO: {
    requiresPrescription: true,
    requiresDoubleCheck: true,
    requiresPsychotropicBook: true,
    requiresManualReview: false,
    riskLevel: "CRITICAL",
  },
};

const VALID_DISPENSACAO = new Set(Object.keys(DISPENSACAO_DEFAULTS));

function asDispensacao(value: unknown): TipoDispensacao {
  const v = String(value ?? "VENDA_LIVRE") as TipoDispensacao;
  return VALID_DISPENSACAO.has(v) ? v : "VENDA_LIVRE";
}

function asRiskLevel(value: unknown): RiskLevel | undefined {
  if (value == null || value === "") return undefined;
  const v = String(value) as RiskLevel;
  return ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(v) ? v : undefined;
}

function applyAntimicrobianoOverrides(policy: ResolvedProdutoPolicy): ResolvedProdutoPolicy {
  if (!policy.antimicrobiano) return policy;

  let tipoDispensacao = policy.tipoDispensacao;
  if (tipoDispensacao === "VENDA_LIVRE" || tipoDispensacao === "RECEITA_SIMPLES") {
    tipoDispensacao = "RECEITA_OBRIGATORIA";
  }

  const base = DISPENSACAO_DEFAULTS[tipoDispensacao];

  return {
    ...policy,
    tipoDispensacao,
    requiresPrescription: true,
    requiresDoubleCheck: base.requiresDoubleCheck,
    requiresPsychotropicBook: base.requiresPsychotropicBook,
    riskLevel: policy.riskLevel === "LOW" ? "MEDIUM" : policy.riskLevel,
  };
}

function mergeExplicitFlags(
  base: ResolvedProdutoPolicy,
  input: ProdutoPolicyInput,
): ResolvedProdutoPolicy {
  const explicitRisk = asRiskLevel(input.riskLevel);

  return {
    ...base,
    requiresPrescription:
      input.requiresPrescription ?? base.requiresPrescription,
    requiresDoubleCheck: input.requiresDoubleCheck ?? base.requiresDoubleCheck,
    requiresPsychotropicBook:
      input.requiresPsychotropicBook ?? base.requiresPsychotropicBook,
    requiresManualReview:
      input.requiresManualReview ?? base.requiresManualReview,
    riskLevel: explicitRisk ?? base.riskLevel,
    classificacaoRule: input.classificacaoRule ?? base.classificacaoRule,
    classificacaoReason: input.classificacaoReason ?? base.classificacaoReason,
    classificacaoMatchedTerm:
      input.classificacaoMatchedTerm ?? base.classificacaoMatchedTerm,
  };
}

/** Resolve política a partir de `tipoDispensacao` e flags (API ou seed). */
export function resolveProdutoPolicy(
  input: ProdutoPolicyInput = {},
): ResolvedProdutoPolicy {
  const tipoDispensacao = asDispensacao(input.tipoDispensacao);
  const baseFromDispensacao = DISPENSACAO_DEFAULTS[tipoDispensacao];

  let policy: ResolvedProdutoPolicy = {
    antimicrobiano: Boolean(input.antimicrobiano),
    tipoDispensacao,
    ...baseFromDispensacao,
    policyVersion: PRODUTO_POLICY_VERSION,
    classificacaoRule: input.classificacaoRule ?? null,
    classificacaoReason: input.classificacaoReason ?? null,
    classificacaoMatchedTerm: input.classificacaoMatchedTerm ?? null,
  };

  policy = mergeExplicitFlags(policy, input);

  return applyAntimicrobianoOverrides(policy);
}

export function policyToRegulacaoRow(
  policy: ResolvedProdutoPolicy,
  classificadoPor: string,
) {
  return {
    antimicrobiano: policy.antimicrobiano,
    tipoDispensacao: policy.tipoDispensacao,
    requiresPrescription: policy.requiresPrescription,
    requiresDoubleCheck: policy.requiresDoubleCheck,
    requiresPsychotropicBook: policy.requiresPsychotropicBook,
    requiresManualReview: policy.requiresManualReview,
    riskLevel: policy.riskLevel,
    policyVersion: policy.policyVersion,
    classificadoPor,
    classificadoEm: new Date(),
  };
}

const REGULATORY_KEYS = new Set([
  "antimicrobiano",
  "tipoDispensacao",
  "requiresPrescription",
  "requiresDoubleCheck",
  "requiresPsychotropicBook",
  "requiresManualReview",
  "riskLevel",
  "classificacaoRule",
  "classificacaoReason",
  "classificacaoMatchedTerm",
]);

export function extractPolicyInput(data: Record<string, unknown>): ProdutoPolicyInput {
  const input: ProdutoPolicyInput = {};
  for (const key of REGULATORY_KEYS) {
    if (key in data && data[key] !== undefined) {
      (input as Record<string, unknown>)[key] = data[key];
    }
  }
  return input;
}

export function hasRegulatoryInput(data: Record<string, unknown>): boolean {
  for (const key of REGULATORY_KEYS) {
    if (key in data && data[key] !== undefined) {
      return true;
    }
  }
  return false;
}
