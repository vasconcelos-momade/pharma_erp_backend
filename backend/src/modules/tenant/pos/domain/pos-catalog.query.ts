import {
  buildFefoLoteWhereForPos,
  buildFefoLoteWhereForPosCandidates,
} from "../../stock/domain/fefo-lote.service";
import { POS_FEFO_LOTE_PREVIEW_LIMIT } from "./pos-catalog.constants";

const posFefoLoteSelect = {
  where: buildFefoLoteWhereForPosCandidates(),
  orderBy: { dataValidade: "asc" as const },
  take: POS_FEFO_LOTE_PREVIEW_LIMIT,
  select: {
    id: true,
    numeroLote: true,
    dataValidade: true,
    precoVenda: true,
    quantidadeQuarentena: true,
    stockBalance: {
      select: { quantidadeDisponivel: true },
    },
  },
};

/** Filtro estrito: produtos com stock em cache e lote FEFO vendável. */
export const posProductStockWhere = {
  stockBalance: { quantidadeDisponivel: { gt: 0 } },
  lotes: { some: buildFefoLoteWhereForPos() },
} as const;

/** Filtro de candidatos à pesquisa POS (stock validado após leitura/enriquecimento). */
export const posProductCandidateWhere = {
  lotes: { some: buildFefoLoteWhereForPosCandidates() },
} as const;

/** Select do catálogo POS — independente do catálogo master de Produtos. */
export const posProductSelect = {
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
  lotes: posFefoLoteSelect,
} as const;

export const posFefoLoteEnrichmentSelect = {
  id: true,
  numeroLote: true,
  dataValidade: true,
  precoVenda: true,
  quantidadeQuarentena: true,
  stockBalance: {
    select: { quantidadeDisponivel: true },
  },
} as const;
