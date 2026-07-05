/**
 * Política de dispensação: 3 tipos; flags legais derivadas automaticamente.
 */

export const PRODUTO_POLICY_VERSION = 3;

export type TipoDispensacao =
  | "VENDA_LIVRE"
  | "RECEITA_NORMAL"
  | "RECEITA_ESPECIAL";

/** Mapeamento de valores legados (7 tipos) para o modelo simplificado. */
export const LEGACY_TIPO_DISPENSACAO_MAP: Record<string, TipoDispensacao> = {
  VENDA_LIVRE: "VENDA_LIVRE",
  RECEITA_NORMAL: "RECEITA_NORMAL",
  RECEITA_ESPECIAL: "RECEITA_ESPECIAL",
  RECEITA_SIMPLES: "RECEITA_NORMAL",
  RECEITA_CONTROLADA: "RECEITA_NORMAL",
  RECEITA_OBRIGATORIA: "RECEITA_NORMAL",
  RECEITA_RETIDA: "RECEITA_NORMAL",
  PSICOTROPICO: "RECEITA_ESPECIAL",
  NARCOTICO: "RECEITA_ESPECIAL",
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ProdutoPolicyInput = {
  tipoDispensacao?: TipoDispensacao | string | null;
  antimicrobiano?: boolean | null;
  requiresDoubleCheck?: boolean | null;
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
  RECEITA_NORMAL: {
    requiresPrescription: true,
    requiresDoubleCheck: false,
    requiresPsychotropicBook: false,
    requiresManualReview: false,
    riskLevel: "MEDIUM",
  },
  RECEITA_ESPECIAL: {
    requiresPrescription: true,
    requiresDoubleCheck: true,
    requiresPsychotropicBook: true,
    requiresManualReview: false,
    riskLevel: "HIGH",
  },
};

export function normalizeTipoDispensacao(value: unknown): TipoDispensacao {
  const raw = String(value ?? "VENDA_LIVRE");
  return LEGACY_TIPO_DISPENSACAO_MAP[raw] ?? "VENDA_LIVRE";
}

function asRiskLevel(value: unknown): RiskLevel | undefined {
  if (value == null || value === "") return undefined;
  const v = String(value) as RiskLevel;
  return ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(v) ? v : undefined;
}

function applyAntimicrobianoOverrides(policy: ResolvedProdutoPolicy): ResolvedProdutoPolicy {
  if (!policy.antimicrobiano) return policy;

  const tipoDispensacao =
    policy.tipoDispensacao === "VENDA_LIVRE"
      ? "RECEITA_NORMAL"
      : policy.tipoDispensacao;

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

function mergeDerivedFlags(
  base: ResolvedProdutoPolicy,
  input: ProdutoPolicyInput,
): ResolvedProdutoPolicy {
  const explicitRisk = asRiskLevel(input.riskLevel);

  return {
    ...base,
    requiresDoubleCheck: input.requiresDoubleCheck ?? base.requiresDoubleCheck,
    requiresManualReview: input.requiresManualReview ?? base.requiresManualReview,
    riskLevel: explicitRisk ?? base.riskLevel,
    classificacaoRule: input.classificacaoRule ?? base.classificacaoRule,
    classificacaoReason: input.classificacaoReason ?? base.classificacaoReason,
    classificacaoMatchedTerm:
      input.classificacaoMatchedTerm ?? base.classificacaoMatchedTerm,
  };
}

/** Resolve política a partir de `tipoDispensacao` (flags legais derivadas). */
export function resolveProdutoPolicy(
  input: ProdutoPolicyInput = {},
): ResolvedProdutoPolicy {
  const tipoDispensacao = normalizeTipoDispensacao(input.tipoDispensacao);
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

  policy = mergeDerivedFlags(policy, input);

  return applyAntimicrobianoOverrides(policy);
}

export function policyToRegulacaoRow(policy: ResolvedProdutoPolicy) {
  return {
    tipoDispensacao: policy.tipoDispensacao,
    requiresPrescription: policy.requiresPrescription,
    requiresPsychotropicBook: policy.requiresPsychotropicBook,
    policyVersion: policy.policyVersion,
  };
}

const REGULATORY_KEYS = new Set([
  "antimicrobiano",
  "tipoDispensacao",
  "requiresDoubleCheck",
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
  if ("tipoDispensacao" in data && data.tipoDispensacao !== undefined) {
    input.tipoDispensacao = normalizeTipoDispensacao(data.tipoDispensacao);
  }
  return input;
}

export function hasRegulatoryInput(data: Record<string, unknown>): boolean {
  for (const key of REGULATORY_KEYS) {
    if (key in data && data[key] !== undefined) {
      return true;
    }
  }
  return "tipoDispensacao" in data && data.tipoDispensacao !== undefined;
}

/** Indica se a dispensação deve gerar registo no Livro de Receitas. */
export function requiresLivroReceita(tipoDispensacao: TipoDispensacao): boolean {
  return tipoDispensacao === "RECEITA_NORMAL" || tipoDispensacao === "RECEITA_ESPECIAL";
}
