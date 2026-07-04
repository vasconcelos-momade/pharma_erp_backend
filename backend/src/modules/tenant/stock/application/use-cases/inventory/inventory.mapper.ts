type InventarioWithRelations = {
  id: bigint;
  codigo: string;
  observacao: string | null;
  status: string;
  iniciadoPorId: bigint;
  reconciliadoPorId: bigint | null;
  iniciadoEm: Date;
  reconciliadoEm: Date | null;
  createdAt: Date;
  iniciadoPor?: { id: bigint; name: string };
  reconciliadoPor?: { id: bigint; name: string } | null;
  itens?: InventarioItemWithRelations[];
  _count?: { itens: number };
};

type InventarioItemWithRelations = {
  id: bigint;
  produtoId: bigint;
  loteId: bigint | null;
  estoqueSistema: unknown;
  estoqueContado: unknown;
  divergencia: unknown;
  produto?: {
    id: bigint;
    nomeComercial: string;
    nomeGenerico: string | null;
    dosagem: string | null;
    forma: string | null;
    apresentacao: string | null;
  };
  lote?: {
    id: bigint;
    numeroLote: string;
    dataValidade: Date;
    stockBalance?: { quantidadeTotal?: unknown } | null;
    fornecedor?: { nome: string } | null;
  } | null;
};

export const inventarioItemInclude = {
  produto: {
    select: {
      id: true,
      nomeComercial: true,
      nomeGenerico: true,
      dosagem: true,
      forma: true,
      apresentacao: true,
    },
  },
  lote: {
    select: {
      id: true,
      numeroLote: true,
      dataValidade: true,
      stockBalance: { select: { quantidadeTotal: true } },
      fornecedor: { select: { nome: true } },
    },
  },
} as const;

export function mapInventarioResumo(inventario: InventarioWithRelations) {
  const itens = inventario.itens ?? [];
  const divergencias = itens.filter((item) => Number(item.divergencia) !== 0).length;

  return {
    id: inventario.id.toString(),
    codigo: inventario.codigo,
    observacao: inventario.observacao,
    status: inventario.status,
    iniciadoPorId: inventario.iniciadoPorId.toString(),
    iniciadoPorNome: inventario.iniciadoPor?.name ?? null,
    reconciliadoPorId: inventario.reconciliadoPorId?.toString() ?? null,
    reconciliadoPorNome: inventario.reconciliadoPor?.name ?? null,
    iniciadoEm: inventario.iniciadoEm.toISOString(),
    reconciliadoEm: inventario.reconciliadoEm?.toISOString() ?? null,
    createdAt: inventario.createdAt.toISOString(),
    totalItens: inventario._count?.itens ?? itens.length,
    itensComDivergencia: divergencias,
  };
}

export function mapInventarioItem(item: InventarioItemWithRelations) {
  return {
    id: item.id.toString(),
    produtoId: item.produtoId.toString(),
    produtoNome: item.produto?.nomeComercial ?? "",
    produtoNomeComercial: item.produto?.nomeComercial ?? "",
    nomeGenerico: item.produto?.nomeGenerico ?? null,
    dosagem: item.produto?.dosagem ?? null,
    forma: item.produto?.forma ?? null,
    apresentacao: item.produto?.apresentacao ?? null,
    loteId: item.loteId?.toString() ?? null,
    numeroLote: item.lote?.numeroLote ?? null,
    dataValidade: item.lote?.dataValidade?.toISOString() ?? null,
    estoqueLoteAtual: Number(
      item.lote?.stockBalance?.quantidadeTotal ?? item.estoqueSistema,
    ),
    fornecedorNome: item.lote?.fornecedor?.nome ?? null,
    estoqueSistema: Number(item.estoqueSistema),
    estoqueContado: Number(item.estoqueContado),
    divergencia: Number(item.divergencia),
  };
}

export function mapInventarioDetalhe(inventario: InventarioWithRelations) {
  return {
    ...mapInventarioResumo(inventario),
    itens: (inventario.itens ?? []).map(mapInventarioItem),
  };
}
