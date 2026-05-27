import { extractCatalogData } from "./produto-catalog";
import { regulacaoToPolicyInput } from "./produto-presenter";
import {
  extractPolicyInput,
  hasRegulatoryInput,
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

export type PrepareProdutoWriteResult = {
  catalogData: Record<string, unknown>;
  policy: ResolvedProdutoPolicy;
};

export function prepareProdutoWrite(
  data: Record<string, unknown>,
  source: ProdutoRegulacaoSource,
  existingPolicy?: ProdutoPolicyInput | null,
): PrepareProdutoWriteResult {
  const incoming = extractPolicyInput(data);
  const mergedInput: ProdutoPolicyInput = {
    ...(existingPolicy ?? {}),
    ...incoming,
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
  const regulacaoRow = policyToRegulacaoRow(policy, source);

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
        rule: policy.classificacaoRule,
        reason: policy.classificacaoReason,
        matchedTerm: policy.classificacaoMatchedTerm,
        source,
        policySnapshot: {
          antimicrobiano: policy.antimicrobiano,
          tipoDispensacao: policy.tipoDispensacao,
          requiresPrescription: policy.requiresPrescription,
          requiresDoubleCheck: policy.requiresDoubleCheck,
          requiresPsychotropicBook: policy.requiresPsychotropicBook,
          requiresManualReview: policy.requiresManualReview,
          riskLevel: policy.riskLevel,
          policyVersion: policy.policyVersion,
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
