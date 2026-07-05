import { extractCatalogData } from "./produto-catalog";
import { isAntimicrobianoFnm } from "./fnm-categorias";
import { regulacaoToPolicyInput } from "./produto-presenter";
import {
  extractPolicyInput,
  policyToRegulacaoRow,
  resolveProdutoPolicy,
  type ProdutoPolicyInput,
  type ResolvedProdutoPolicy,
} from "./produto-dispensacao-policy";

export type ProdutoRegulacaoSource =
  | "api:create"
  | "api:update"
  | "seed:anarme"
  | "backfill:legacy";

type ClassificacaoSourceValue = "MANUAL" | "REGRA" | "IMPORTACAO" | "IA";

export type ProdutoRegulacaoPersistenceClient = {
  produtoRegulacao: {
    upsert: (args: {
      where: { produtoId: bigint };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  produtoClassificacaoEvento: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
};

export function toProdutoRegulacaoTx(tx: unknown): ProdutoRegulacaoPersistenceClient {
  return tx as ProdutoRegulacaoPersistenceClient;
}

export function mapRegulacaoSourceToClassificacaoSource(
  source: ProdutoRegulacaoSource,
): ClassificacaoSourceValue {
  switch (source) {
    case "seed:anarme":
      return "IMPORTACAO";
    case "api:create":
    case "api:update":
      return "MANUAL";
    case "backfill:legacy":
    default:
      return "REGRA";
  }
}

export type PrepareProdutoWriteResult = {
  catalogData: Record<string, unknown>;
  policy: ResolvedProdutoPolicy;
};

export function prepareProdutoWrite(
  data: Record<string, unknown>,
  source: ProdutoRegulacaoSource,
  existingPolicy?: ProdutoPolicyInput | null,
  categoria?: { nome?: string | null; codigoFNM?: string | null } | null,
): PrepareProdutoWriteResult {
  const incoming = extractPolicyInput(data);
  delete (incoming as Record<string, unknown>).antimicrobiano;

  const mergedInput: ProdutoPolicyInput = {
    ...(existingPolicy ?? {}),
    ...incoming,
    antimicrobiano: isAntimicrobianoFnm(categoria),
  };
  const policy = resolveProdutoPolicy(mergedInput);
  const catalogData = extractCatalogData(data);

  return { catalogData, policy };
}

export async function persistProdutoRegulacao(
  tx: ProdutoRegulacaoPersistenceClient,
  produtoId: bigint,
  policy: ResolvedProdutoPolicy,
  source: ProdutoRegulacaoSource,
): Promise<void> {
  const regulacaoRow = policyToRegulacaoRow(policy);

  await tx.produtoRegulacao.upsert({
    where: { produtoId },
    create: {
      produtoId,
      ...regulacaoRow,
    },
    update: regulacaoRow,
  });

  if (policy.classificacaoRule) {
    await tx.produtoClassificacaoEvento.create({
      data: {
        produtoId,
        source: mapRegulacaoSourceToClassificacaoSource(source),
        observacao: policy.classificacaoReason ?? null,
        snapshot: {
          rule: policy.classificacaoRule,
          reason: policy.classificacaoReason,
          matchedTerm: policy.classificacaoMatchedTerm,
          tipoDispensacao: policy.tipoDispensacao,
          policyVersion: policy.policyVersion,
          resolved: {
            antimicrobiano: policy.antimicrobiano,
            requiresPrescription: policy.requiresPrescription,
            requiresDoubleCheck: policy.requiresDoubleCheck,
            requiresPsychotropicBook: policy.requiresPsychotropicBook,
            requiresManualReview: policy.requiresManualReview,
            riskLevel: policy.riskLevel,
          },
        },
      },
    });
  }
}

export function policyInputFromProdutoRow(
  produto: Record<string, unknown> & { regulacao?: Record<string, unknown> | null },
): ProdutoPolicyInput {
  if (produto.regulacao) {
    return regulacaoToPolicyInput(
      produto.regulacao as Parameters<typeof regulacaoToPolicyInput>[0],
    );
  }
  return {};
}
