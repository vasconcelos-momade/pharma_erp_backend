import type { ResolvedProdutoPolicy } from "./produto-dispensacao-policy";
import { resolveProdutoPolicy, type ProdutoPolicyInput } from "./produto-dispensacao-policy";
import { isAntimicrobianoFnm } from "./fnm-categorias";
import {
  buildFefoLoteWhereForPos,
  resolveLotePrecoVenda,
} from "../../stock/domain/fefo-lote.service";

export type ProdutoRegulacaoRow = {
  tipoDispensacao: string;
  requiresPrescription?: boolean;
  requiresPsychotropicBook?: boolean;
  policyVersion?: number;
  updatedAt?: Date;
};

type FefoLotePreview = {
  id?: bigint;
  numeroLote?: string;
  dataValidade?: Date;
  precoVenda?: unknown | null;
  quantidadeQuarentena?: unknown;
  stockBalance?: { quantidadeDisponivel?: unknown; quantidadeTotal?: unknown } | null;
};

type CategoriaPreview = {
  id?: bigint;
  nome?: string;
  codigoFNM?: string | null;
  descricao?: string | null;
  ativo?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

function pickFefoLote(lotes?: FefoLotePreview[]): FefoLotePreview | null {
  if (!lotes?.length) {
    return null;
  }
  return (
    lotes.find(
      (lote) => Number(lote.stockBalance?.quantidadeDisponivel ?? 0) > 0,
    ) ??
    lotes[0] ??
    null
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

export function resolveRegulacaoPolicyForProduto(produto: {
  regulacao?: ProdutoRegulacaoRow | null;
  categoria?: CategoriaPreview | null;
}): ResolvedProdutoPolicy {
  const categoria =
    produto.categoria && produto.categoria.id !== undefined
      ? {
          id: produto.categoria.id,
          nome: produto.categoria.nome ?? "",
          codigoFNM: produto.categoria.codigoFNM ?? null,
          descricao: produto.categoria.descricao ?? null,
          ativo: produto.categoria.ativo ?? true,
        }
      : null;

  const policyInput = produto.regulacao
    ? regulacaoToPolicyInput(produto.regulacao)
    : {};
  policyInput.antimicrobiano = isAntimicrobianoFnm(categoria);
  return resolveProdutoPolicy(policyInput);
}

/** API: campos regulatórios flat + `estoqueAtual` (cache) + `precoVenda` (lote FEFO). */
export function flattenProdutoForApi<T extends Record<string, unknown>>(
  produto: T & {
    regulacao?: ProdutoRegulacaoRow | null;
    stockBalance?: { quantidadeDisponivel?: unknown } | null;
    lotes?: FefoLotePreview[];
    categoria?: CategoriaPreview | null;
  },
): T & ResolvedProdutoPolicy & { estoqueAtual: number; precoVenda: number } {
  const categoria =
    produto.categoria && produto.categoria.id !== undefined
      ? {
          id: produto.categoria.id,
          nome: produto.categoria.nome ?? "",
          codigoFNM: produto.categoria.codigoFNM ?? null,
          descricao: produto.categoria.descricao ?? null,
          ativo: produto.categoria.ativo ?? true,
          createdAt: produto.categoria.createdAt,
          updatedAt: produto.categoria.updatedAt,
        }
      : null;

  const policyInput = produto.regulacao
    ? regulacaoToPolicyInput(produto.regulacao)
    : {};
  policyInput.antimicrobiano = isAntimicrobianoFnm(categoria);
  const resolved = resolveProdutoPolicy(policyInput);

  const { regulacao: _regulacao, lotes: _lotes, ...base } = produto;
  const disponivel = Number(produto.stockBalance?.quantidadeDisponivel ?? 0);
  const fefoLote = pickFefoLote(produto.lotes);
  const nomeComercial =
    typeof produto.nomeComercial === "string" ? produto.nomeComercial : undefined;

  return {
    ...base,
    categoria,
    categoriaNome: categoria?.nome ?? null,
    categoriaCodigoFNM: categoria?.codigoFNM ?? null,
    ...resolved,
    estoqueAtual: disponivel,
    precoVenda: resolveApiPrecoVenda(fefoLote, nomeComercial),
    regulacao: produto.regulacao ?? null,
  } as unknown as T & ResolvedProdutoPolicy & { estoqueAtual: number; precoVenda: number };
}

export function regulacaoToPolicyInput(
  regulacao: ProdutoRegulacaoRow,
): ProdutoPolicyInput {
  return {
    tipoDispensacao: regulacao.tipoDispensacao as ProdutoPolicyInput["tipoDispensacao"],
    requiresPrescription: regulacao.requiresPrescription,
    requiresPsychotropicBook: regulacao.requiresPsychotropicBook,
  };
}

export const produtoWithRegulacaoInclude = {
  categoria: true,
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
  where: buildFefoLoteWhereForPos(),
  orderBy: { dataValidade: "asc" as const },
  take: 3,
  select: {
    id: true,
    numeroLote: true,
    dataValidade: true,
    precoVenda: true,
    precoCompra: true,
    quantidadeQuarentena: true,
    stockBalance: {
      select: { quantidadeDisponivel: true },
    },
  },
};

/** Filtro Prisma: produtos com stock disponível e lote FEFO válido para venda. */
export const produtoPosStockWhere = {
  stockBalance: { quantidadeDisponivel: { gt: 0 } },
  lotes: { some: buildFefoLoteWhereForPos() },
} as const;

export const produtoPosSelect = {
  id: true,
  nomeComercial: true,
  barcode: true,
  categoriaId: true,
  categoria: {
    select: {
      id: true,
      nome: true,
      codigoFNM: true,
      descricao: true,
      ativo: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  nomeGenerico: true,
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
const masterProximaValidadeLoteSelect = {
  where: {
    ativo: true,
    deletedAt: null,
    stockBalance: {
      quantidadeDisponivel: { gt: 0 },
    },
  },
  orderBy: { dataValidade: "asc" as const },
  take: 1,
  select: {
    id: true,
    numeroLote: true,
    dataValidade: true,
  },
};

export const produtoMasterListSelect = {
  id: true,
  nomeComercial: true,
  barcode: true,
  categoriaId: true,
  categoria: {
    select: {
      id: true,
      nome: true,
      codigoFNM: true,
      descricao: true,
      ativo: true,
    },
  },
  estoqueMinimo: true,
  nomeGenerico: true,
  dosagem: true,
  forma: true,
  apresentacao: true,
  ativo: true,
  createdAt: true,
  regulacao: true,
  stockBalance: {
    select: {
      quantidadeDisponivel: true,
      quantidadeTotal: true,
    },
  },
  _count: {
    select: {
      lotes: {
        where: {
          ativo: true,
          deletedAt: null,
        },
      },
    },
  },
  lotes: masterProximaValidadeLoteSelect,
} as const;

/** Item de listagem master (catálogo ERP) com agregados de stock/lotes. */
export function mapMasterProdutoListItem<T extends Record<string, unknown>>(
  row: T,
): T & ResolvedProdutoPolicy & {
  estoqueAtual: number;
  numLotes: number;
  proximaValidade: string | null;
  lote: string | null;
  dataValidade: string | null;
} {
  const flat = flattenProdutoForApi(row);
  const proximoLote = (
    row as { lotes?: Array<{ numeroLote?: string; dataValidade?: Date }> }
  ).lotes?.[0];

  return {
    ...flat,
    estoqueAtual: flat.estoqueAtual,
    numLotes: Number((row as { _count?: { lotes?: number } })._count?.lotes ?? 0),
    proximaValidade: proximoLote?.dataValidade?.toISOString() ?? null,
    lote: proximoLote?.numeroLote ?? null,
    dataValidade: proximoLote?.dataValidade?.toISOString() ?? null,
  } as T & ResolvedProdutoPolicy & {
    estoqueAtual: number;
    numLotes: number;
    proximaValidade: string | null;
    lote: string | null;
    dataValidade: string | null;
  };
}

export const produtoStockSearchSelect = {
  id: true,
  nomeComercial: true,
  barcode: true,
  categoriaId: true,
  categoria: {
    select: {
      id: true,
      nome: true,
      codigoFNM: true,
      descricao: true,
      ativo: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  estoqueMinimo: true,
  nomeGenerico: true,
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

/** Produto para pesquisa em stock (lote opcional FEFO). */
export function mapStockSearchProduto<T extends Record<string, unknown>>(
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
