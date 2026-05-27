import type { ResolvedProdutoPolicy } from "./produto-dispensacao-policy";
import { resolveProdutoPolicy, type ProdutoPolicyInput } from "./produto-dispensacao-policy";

export type ProdutoRegulacaoRow = {
  antimicrobiano: boolean;
  tipoDispensacao: string;
  requiresPrescription: boolean;
  requiresDoubleCheck: boolean;
  requiresPsychotropicBook: boolean;
  requiresManualReview: boolean;
  riskLevel: string;
  policyVersion?: number;
  classificadoEm?: Date;
  classificadoPor?: string | null;
};

/** API/POS: campos regulatórios flat a partir de `produto.regulacao`. */
export function flattenProdutoForApi<T extends Record<string, unknown>>(
  produto: T & { regulacao?: ProdutoRegulacaoRow | null },
): T & ResolvedProdutoPolicy {
  const policy = produto.regulacao
    ? regulacaoToPolicyInput(produto.regulacao)
    : {};
  const resolved = resolveProdutoPolicy(policy);

  const { regulacao: _regulacao, ...base } = produto;
  return {
    ...base,
    ...resolved,
    regulacao: produto.regulacao ?? null,
  } as T & ResolvedProdutoPolicy;
}

export function regulacaoToPolicyInput(
  regulacao: ProdutoRegulacaoRow,
): ProdutoPolicyInput {
  return {
    tipoDispensacao: regulacao.tipoDispensacao as ProdutoPolicyInput["tipoDispensacao"],
    antimicrobiano: regulacao.antimicrobiano,
    requiresPrescription: regulacao.requiresPrescription,
    requiresDoubleCheck: regulacao.requiresDoubleCheck,
    requiresPsychotropicBook: regulacao.requiresPsychotropicBook,
    requiresManualReview: regulacao.requiresManualReview,
    riskLevel: regulacao.riskLevel as ProdutoPolicyInput["riskLevel"],
  };
}

export const produtoWithRegulacaoInclude = {
  regulacao: true,
  taxRule: true,
} as const;

export const produtoPosSelect = {
  id: true,
  nome: true,
  barcode: true,
  precoVenda: true,
  estoqueAtual: true,
  substanciaActiva: true,
  dosagem: true,
  forma: true,
  regulacao: true,
  stockBalance: {
    select: {
      quantidadeDisponivel: true,
      quantidadeTotal: true,
    },
  },
  taxRule: {
    select: {
      tipo: true,
      taxa: true,
      codigo: true,
    },
  },
  lotes: {
    where: { ativo: true },
    orderBy: { dataValidade: "asc" as const },
    take: 1,
    select: {
      numeroLote: true,
      dataValidade: true,
    },
  },
};

/** Produto para POS: regulacao flat + stock de StockBalance. */
export function mapPosProduto<T extends Record<string, unknown>>(row: T): T & ResolvedProdutoPolicy {
  const flat = flattenProdutoForApi(row);
  const disponivel = Number(
    (row as { stockBalance?: { quantidadeDisponivel?: unknown } }).stockBalance
      ?.quantidadeDisponivel ?? flat.estoqueAtual ?? 0,
  );
  return {
    ...flat,
    estoqueAtual: disponivel,
  } as T & ResolvedProdutoPolicy;
}
