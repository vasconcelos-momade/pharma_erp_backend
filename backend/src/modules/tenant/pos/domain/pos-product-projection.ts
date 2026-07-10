import type { ResolvedProdutoPolicy } from "../../products/domain/produto-dispensacao-policy";
import type { ProdutoRegulacaoRow } from "../../products/domain/produto-presenter";

export type PosCategoriaProjection = {
  id: bigint;
  nome: string;
  codigoFNM: string | null;
  descricao: string | null;
  ativo: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type PosTaxRuleProjection = {
  tipo: string;
  taxa: unknown;
  codigo: string | null;
};

export type PosLoteProjection = {
  id: bigint;
  numeroLote: string;
  dataValidade: Date;
  quantidadeDisponivel: number;
  precoVenda: number;
};

/** Projeção interna do catálogo POS — apenas campos necessários à venda. */
export type PosProductProjection = {
  id: bigint;
  nomeComercial: string;
  nomeGenerico: string | null;
  barcode: string | null;
  categoriaId: bigint | null;
  categoria: PosCategoriaProjection | null;
  categoriaNome: string | null;
  categoriaCodigoFNM: string | null;
  dosagem: string | null;
  forma: string | null;
  apresentacao: string | null;
  ativo: boolean;
  taxRule: PosTaxRuleProjection | null;
  regulacao: ProdutoRegulacaoRow | null;
  estoqueAtual: number;
  precoVenda: number;
  lote: string | null;
  dataValidade: string | null;
  fefoLotes: PosLoteProjection[];
} & ResolvedProdutoPolicy;
