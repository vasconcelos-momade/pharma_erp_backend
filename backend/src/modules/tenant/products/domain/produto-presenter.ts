import type { ResolvedProdutoPolicy } from "./produto-dispensacao-policy";
import { resolveProdutoPolicy, type ProdutoPolicyInput } from "./produto-dispensacao-policy";
import {
  FEFO_LOTE_FILTER,
  loteQuantidadeDisponivel,
  resolveLotePrecoVenda,
} from "../../stock/domain/fefo-lote.service";

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

type FefoLotePreview = {
  id?: bigint;
  numeroLote?: string;
  dataValidade?: Date;
  precoVenda?: unknown | null;
  quantidadeAtual?: unknown;
  quantidadeQuarentena?: unknown;
};

function pickFefoLote(lotes?: FefoLotePreview[]): FefoLotePreview | null {
  if (!lotes?.length) {
    return null;
  }
  return (
    lotes.find((lote) => loteQuantidadeDisponivel(lote) > 0) ?? lotes[0] ?? null
  );
}

function resolveApiPrecoVenda(
  lote: FefoLotePreview | null,
  produtoNome?: string,
): number {
  if (!lote?.precoVenda) {
    return 0;
  }
  try {
    return resolveLotePrecoVenda(lote, produtoNome);
  } catch {
    return 0;
  }
}

/** API: campos regulatórios flat + `estoqueAtual` (cache) + `precoVenda` (lote FEFO). */
export function flattenProdutoForApi<T extends Record<string, unknown>>(
  produto: T & {
    regulacao?: ProdutoRegulacaoRow | null;
    stockBalance?: { quantidadeDisponivel?: unknown } | null;
    lotes?: FefoLotePreview[];
  },
): T & ResolvedProdutoPolicy & { estoqueAtual: number; precoVenda: number } {
  const policy = produto.regulacao
    ? regulacaoToPolicyInput(produto.regulacao)
    : {};
  const resolved = resolveProdutoPolicy(policy);

  const { regulacao: _regulacao, lotes: _lotes, ...base } = produto;
  const disponivel = Number(produto.stockBalance?.quantidadeDisponivel ?? 0);
  const fefoLote = pickFefoLote(produto.lotes);
  const nome = typeof produto.nome === "string" ? produto.nome : undefined;

  return {
    ...base,
    ...resolved,
    estoqueAtual: disponivel,
    precoVenda: resolveApiPrecoVenda(fefoLote, nome),
    regulacao: produto.regulacao ?? null,
  } as unknown as T & ResolvedProdutoPolicy & { estoqueAtual: number; precoVenda: number };
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

const fefoLoteSelect = {
  where: FEFO_LOTE_FILTER,
  orderBy: { dataValidade: "asc" as const },
  take: 3,
  select: {
    id: true,
    numeroLote: true,
    dataValidade: true,
    precoVenda: true,
    precoCompra: true,
    quantidadeAtual: true,
    quantidadeQuarentena: true,
  },
};

export const produtoPosSelect = {
  id: true,
  nome: true,
  barcode: true,
  categoria: true,
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
  lotes: fefoLoteSelect,
};

/** Select de catálogo para Requisições (Stock): independente do POS. */
export const produtoRequisicaoSelect = {
  id: true,
  nome: true,
  barcode: true,
  categoria: true,
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
  lotes: fefoLoteSelect,
} as const;

/** Produto para Requisições: todos os activos; lote opcional (FEFO). */
export function mapRequisicaoProduto<T extends Record<string, unknown>>(
  row: T,
): T & ResolvedProdutoPolicy & {
  lote: string | null;
  dataValidade: string | null;
  precoVenda: number;
} {
  const flat = flattenProdutoForApi(row);
  const primeiroLote = pickFefoLote(
    (row as { lotes?: FefoLotePreview[] }).lotes,
  );

  return {
    ...flat,
    estoqueAtual: flat.estoqueAtual,
    precoVenda: flat.precoVenda,
    lote: primeiroLote?.numeroLote ?? null,
    dataValidade: primeiroLote?.dataValidade?.toISOString() ?? null,
  } as T & ResolvedProdutoPolicy & {
    lote: string | null;
    dataValidade: string | null;
    precoVenda: number;
  };
}

/** Produto para POS: regulacao flat + stock cache + preço do lote FEFO. */
export function mapPosProduto<T extends Record<string, unknown>>(
  row: T,
): T & ResolvedProdutoPolicy & { precoVenda: number } {
  const flat = flattenProdutoForApi(row);
  const primeiroLote = pickFefoLote(
    (row as { lotes?: FefoLotePreview[] }).lotes,
  );

  return {
    ...flat,
    estoqueAtual: flat.estoqueAtual,
    precoVenda: flat.precoVenda,
    lote: primeiroLote?.numeroLote ?? null,
    dataValidade: primeiroLote?.dataValidade?.toISOString() ?? null,
  } as T & ResolvedProdutoPolicy & { precoVenda: number };
}
