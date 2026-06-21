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

/** API: campos regulatórios flat + `estoqueAtual` calculado de StockBalance. */
export function flattenProdutoForApi<T extends Record<string, unknown>>(
  produto: T & {
    regulacao?: ProdutoRegulacaoRow | null;
    stockBalance?: { quantidadeDisponivel?: unknown } | null;
  },
): T & ResolvedProdutoPolicy & { estoqueAtual: number } {
  const policy = produto.regulacao
    ? regulacaoToPolicyInput(produto.regulacao)
    : {};
  const resolved = resolveProdutoPolicy(policy);

  const { regulacao: _regulacao, ...base } = produto;
  const disponivel = Number(produto.stockBalance?.quantidadeDisponivel ?? 0);

  return {
    ...base,
    ...resolved,
    estoqueAtual: disponivel,
    regulacao: produto.regulacao ?? null,
  } as unknown as T & ResolvedProdutoPolicy & { estoqueAtual: number };
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
  stockBalance: {
    select: {
      quantidadeDisponivel: true,
      quantidadeTotal: true,
      quantidadeReservada: true,
    },
  },
} as const;

export const produtoPosSelect = {
  id: true,
  nome: true,
  barcode: true,
  precoVenda: true,
  substanciaActiva: true,
  dosagem: true,
  forma: true,
  apresentacao: true,
  ativo: true,
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
    where: { ativo: true, deletedAt: null },
    orderBy: { dataValidade: "asc" as const },
    take: 1,
    select: {
      numeroLote: true,
      dataValidade: true,
    },
  },
};

/** Select de catálogo para Requisições (Stock): independente do POS. */
export const produtoRequisicaoSelect = {
  id: true,
  nome: true,
  barcode: true,
  precoVenda: true,
  estoqueMinimo: true,
  substanciaActiva: true,
  dosagem: true,
  forma: true,
  apresentacao: true,
  ativo: true,
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
    where: {
      ativo: true,
      deletedAt: null,
      disponibilidade: "DISPONIVEL" as const,
      estadoSanitario: "VALIDO" as const,
    },
    orderBy: { dataValidade: "asc" as const },
    take: 1,
    select: {
      numeroLote: true,
      dataValidade: true,
    },
  },
} as const;

/** Produto para Requisições: todos os activos; lote opcional (FEFO). */
export function mapRequisicaoProduto<T extends Record<string, unknown>>(
  row: T,
): T & ResolvedProdutoPolicy & { lote: string | null; dataValidade: string | null } {
  const flat = flattenProdutoForApi(row);
  const disponivel = Number(
    (row as { stockBalance?: { quantidadeDisponivel?: unknown } }).stockBalance
      ?.quantidadeDisponivel ?? 0,
  );
  const lotes = (row as { lotes?: Array<{ numeroLote?: string; dataValidade?: Date }> }).lotes;
  const primeiroLote = lotes?.[0];

  return {
    ...flat,
    estoqueAtual: disponivel,
    lote: primeiroLote?.numeroLote ?? null,
    dataValidade: primeiroLote?.dataValidade?.toISOString() ?? null,
  } as T & ResolvedProdutoPolicy & { lote: string | null; dataValidade: string | null };
}

/** Produto para POS: regulacao flat + stock de StockBalance. */
export function mapPosProduto<T extends Record<string, unknown>>(row: T): T & ResolvedProdutoPolicy {
  const flat = flattenProdutoForApi(row);
  const disponivel = Number(
    (row as { stockBalance?: { quantidadeDisponivel?: unknown } }).stockBalance
      ?.quantidadeDisponivel ?? 0,
  );
  const lotes = (row as { lotes?: Array<{ numeroLote?: string; dataValidade?: Date }> }).lotes;
  const primeiroLote = lotes?.[0];

  return {
    ...flat,
    estoqueAtual: disponivel,
    lote: primeiroLote?.numeroLote ?? null,
    dataValidade: primeiroLote?.dataValidade?.toISOString() ?? null,
  } as T & ResolvedProdutoPolicy;
}
