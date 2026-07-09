import { FiscalCalculatorUtil } from "../../../../../shared/utils/fiscal-calculator.util";

type TaxRuleRow = {
  codigo: string;
  tipo: string;
  taxa: unknown;
};

export type ProformaInvoiceItemRow = {
  id: bigint;
  proformaInvoiceId: bigint;
  produtoId?: bigint | null;
  servicoId?: bigint | null;
  descricao?: string | null;
  quantidade: unknown;
  precoUnit: unknown;
  desconto?: unknown;
  iva?: unknown;
  valorIva?: unknown;
  subtotal?: unknown;
  total?: unknown;
  produto?: {
    id: bigint;
    nomeComercial?: string;
    nome?: string;
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

export type ProformaInvoiceItemApi = {
  id: string;
  proformaInvoiceId: string;
  produtoId: string | null;
  servicoId: string | null;
  tipo: "PRODUTO" | "SERVICO";
  descricao: string;
  quantidade: number;
  precoUnit: number;
  desconto: number;
  subtotal: number;
  iva: number;
  valorIva: number;
  total: number;
  baseCalculo: number;
  taxaAplicada: number;
  tipoRegraFiscalSnapshot: string | null;
  codigoRegraFiscal: string | null;
  motivoIsencao: string | null;
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

export type ProformaInvoiceItemSnapshotInput = {
  quantidade: number;
  precoUnit: number;
  desconto?: number;
  descontoPercent?: number;
  descricao?: string | null;
  taxRule?: TaxRuleRow | null;
};

function resolveTaxRule(row: ProformaInvoiceItemRow | ProformaInvoiceItemSnapshotInput) {
  const taxRule =
    "produto" in row
      ? row.produto?.taxRule ?? row.servico?.taxRule ?? null
      : row.taxRule ?? null;
  if (!taxRule) {
    return null;
  }

  return {
    codigo: taxRule.codigo,
    tipo: taxRule.tipo as
      | "IVA_NORMAL"
      | "IVA_REDUZIDO"
      | "IVA_ISENTO"
      | "NAO_TRIBUTAVEL",
    taxa: Number(taxRule.taxa),
  };
}

export function resolveProformaInvoiceItemDescricao(
  row: ProformaInvoiceItemRow,
  overrideDescricao?: string | null,
): string {
  const custom = overrideDescricao?.trim() || row.descricao?.trim();
  if (custom) {
    return custom;
  }

  return (
    row.produto?.nomeComercial ??
    row.produto?.nome ??
    row.servico?.nome ??
    "Item"
  );
}

export function computeProformaInvoiceItemSnapshot(input: ProformaInvoiceItemSnapshotInput) {
  const quantidade = Number(input.quantidade);
  const precoUnit = Number(input.precoUnit);
  const baseBruta = quantidade * precoUnit;

  let descontoValor = Number(input.desconto ?? 0);
  if (input.descontoPercent != null && Number.isFinite(input.descontoPercent)) {
    descontoValor = baseBruta * (Math.max(0, input.descontoPercent) / 100);
  }
  descontoValor = Math.min(baseBruta, Math.max(0, descontoValor));

  const baseCalculo = baseBruta - descontoValor;
  const taxRule = resolveTaxRule(input);
  const fiscal = FiscalCalculatorUtil.calcularIVA({
    quantidade: 1,
    precoUnitario: baseCalculo,
    taxRule,
    descricao: input.descricao ?? "Item",
  });

  return {
    descricao: input.descricao?.trim() || "Item",
    quantidade,
    precoUnit,
    desconto: descontoValor,
    subtotal: baseCalculo,
    iva: fiscal.taxaAplicadaPercentual,
    valorIva: fiscal.valorIva,
    total: fiscal.totalItem,
    baseCalculo,
    taxaAplicada: fiscal.taxaAplicadaPercentual,
    tipoRegraFiscalSnapshot: fiscal.tipoRegraFiscal ?? null,
    codigoRegraFiscal: fiscal.codigoRegraFiscal ?? null,
    motivoIsencao: fiscal.motivoIsencao ?? null,
  };
}

function hasPersistedSnapshot(row: ProformaInvoiceItemRow) {
  return row.subtotal != null && row.total != null && row.descricao != null;
}

export function buildProformaInvoiceItemApi(
  row: ProformaInvoiceItemRow,
  overrideDescricao?: string | null,
): ProformaInvoiceItemApi {
  const descricao = resolveProformaInvoiceItemDescricao(row, overrideDescricao);
  const quantidade = Number(row.quantidade);
  const precoUnit = Number(row.precoUnit);

  const snapshot = hasPersistedSnapshot(row)
    ? {
        descricao,
        quantidade,
        precoUnit,
        desconto: Number(row.desconto ?? 0),
        subtotal: Number(row.subtotal ?? 0),
        iva: Number(row.iva ?? 0),
        valorIva: Number(row.valorIva ?? 0),
        total: Number(row.total ?? 0),
        baseCalculo: Number(row.subtotal ?? 0),
        taxaAplicada: Number(row.iva ?? 0),
        tipoRegraFiscalSnapshot: null as string | null,
        codigoRegraFiscal: null as string | null,
        motivoIsencao: null as string | null,
      }
    : computeProformaInvoiceItemSnapshot({
        quantidade,
        precoUnit,
        desconto: Number(row.desconto ?? 0),
        descricao,
        taxRule: resolveTaxRule(row),
      });

  return {
    id: row.id.toString(),
    proformaInvoiceId: row.proformaInvoiceId.toString(),
    produtoId: row.produtoId?.toString() ?? null,
    servicoId: row.servicoId?.toString() ?? null,
    tipo: row.produtoId ? "PRODUTO" : "SERVICO",
    descricao: snapshot.descricao,
    quantidade: snapshot.quantidade,
    precoUnit: snapshot.precoUnit,
    desconto: snapshot.desconto,
    subtotal: snapshot.subtotal,
    iva: snapshot.iva,
    valorIva: snapshot.valorIva,
    total: snapshot.total,
    baseCalculo: snapshot.baseCalculo,
    taxaAplicada: snapshot.taxaAplicada,
    tipoRegraFiscalSnapshot: snapshot.tipoRegraFiscalSnapshot,
    codigoRegraFiscal: snapshot.codigoRegraFiscal,
    motivoIsencao: snapshot.motivoIsencao,
    produto: row.produto
      ? {
          id: row.produto.id.toString(),
          nome: row.produto.nomeComercial ?? row.produto.nome ?? descricao,
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

export function buildProformaInvoiceTotals(
  items: ProformaInvoiceItemApi[],
  descontoGeral = 0,
  persisted?: { subtotal?: number; ivaTotal?: number; total?: number },
) {
  if (persisted?.total != null && persisted.subtotal != null) {
    return {
      subtotal: Number(persisted.subtotal),
      ivaTotal: Number(persisted.ivaTotal ?? 0),
      total: Number(persisted.total),
    };
  }

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const ivaTotal = items.reduce((sum, item) => sum + item.valorIva, 0);
  const total = Math.max(0, subtotal + ivaTotal - Number(descontoGeral ?? 0));

  return { subtotal, ivaTotal, total };
}
