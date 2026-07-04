import { FiscalCalculatorUtil } from "../../../../../shared/utils/fiscal-calculator.util";

type TaxRuleRow = {
  codigo: string;
  tipo: string;
  taxa: unknown;
};

export type CotacaoItemRow = {
  id: bigint;
  cotacaoId: bigint;
  produtoId?: bigint | null;
  servicoId?: bigint | null;
  quantidade: unknown;
  precoUnit: unknown;
  produto?: {
    id: bigint;
    nome: string;
    barcode?: string | null;
    taxRule?: TaxRuleRow | null;
  } | null;
  servico?: {
    id: bigint;
    nome: string;
    preco: unknown;
    taxRule?: TaxRuleRow | null;
  } | null;
};

export type CotacaoItemApi = {
  id: string;
  cotacaoId: string;
  produtoId: string | null;
  servicoId: string | null;
  descricao: string;
  quantidade: number;
  precoUnit: number;
  baseCalculo: number;
  iva: number;
  valorIva: number;
  taxaAplicada: number;
  tipoRegraFiscalSnapshot: string | null;
  codigoRegraFiscal: string | null;
  motivoIsencao: string | null;
  total: number;
  produto: {
    id: string;
    nome: string;
    barcode: string | null;
  } | null;
  servico: {
    id: string;
    nome: string;
    preco: number;
  } | null;
};

function resolveTaxRule(row: CotacaoItemRow) {
  const taxRule = row.produto?.taxRule ?? row.servico?.taxRule ?? null;
  if (!taxRule) {
    return null;
  }

  return {
    codigo: taxRule.codigo,
    tipo: taxRule.tipo as "IVA_NORMAL" | "IVA_REDUZIDO" | "IVA_ISENTO" | "NAO_TRIBUTAVEL",
    taxa: Number(taxRule.taxa),
  };
}

export function resolveCotacaoItemDescricao(
  row: CotacaoItemRow,
  overrideDescricao?: string | null,
): string {
  const custom = overrideDescricao?.trim();
  if (custom) {
    return custom;
  }

  return row.produto?.nomeComercial ?? row.servico?.nome ?? "Item";
}

export function computeCotacaoItemFiscal(
  row: CotacaoItemRow,
  overrideDescricao?: string | null,
) {
  return FiscalCalculatorUtil.calcularIVA({
    quantidade: Number(row.quantidade),
    precoUnitario: Number(row.precoUnit),
    taxRule: resolveTaxRule(row),
    descricao: resolveCotacaoItemDescricao(row, overrideDescricao),
  });
}

export function buildCotacaoItemApi(
  row: CotacaoItemRow,
  overrideDescricao?: string | null,
): CotacaoItemApi {
  const fiscal = computeCotacaoItemFiscal(row, overrideDescricao);

  return {
    id: row.id.toString(),
    cotacaoId: row.cotacaoId.toString(),
    produtoId: row.produtoId?.toString() ?? null,
    servicoId: row.servicoId?.toString() ?? null,
    descricao: resolveCotacaoItemDescricao(row, overrideDescricao),
    quantidade: Number(row.quantidade),
    precoUnit: Number(row.precoUnit),
    baseCalculo: fiscal.baseCalculo,
    iva: fiscal.taxaAplicadaPercentual,
    valorIva: fiscal.valorIva,
    taxaAplicada: fiscal.taxaAplicadaPercentual,
    tipoRegraFiscalSnapshot: fiscal.tipoRegraFiscal ?? null,
    codigoRegraFiscal: fiscal.codigoRegraFiscal ?? null,
    motivoIsencao: fiscal.motivoIsencao ?? null,
    total: fiscal.totalItem,
    produto: row.produto
      ? {
          id: row.produto.id.toString(),
          nome: row.produto.nomeComercial,
          barcode: row.produto.barcode ?? null,
        }
      : null,
    servico: row.servico
      ? {
          id: row.servico.id.toString(),
          nome: row.servico.nome,
          preco: Number(row.servico.preco),
        }
      : null,
  };
}

export function buildCotacaoTotals(items: CotacaoItemApi[], desconto = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.baseCalculo, 0);
  const ivaTotal = items.reduce((sum, item) => sum + item.valorIva, 0);
  const total = Math.max(0, subtotal + ivaTotal - Number(desconto ?? 0));

  return { subtotal, ivaTotal, total };
}
