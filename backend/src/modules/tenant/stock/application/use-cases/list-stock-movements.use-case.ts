import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";

type ListStockMovementsParams = {
  q?: string;
  tipo?: string;
  origem?: string;
  produtoId?: string;
  loteId?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
};

type StockMovementAggregateRow = {
  _count?: { _all?: number };
  _sum?: { quantidade?: unknown };
};

const MOVEMENT_TYPES = [
  "ENTRADA",
  "COMPRA",
  "SAIDA",
  "AJUSTE",
  "DEVOLUCAO",
  "QUARENTENA",
  "INCINERACAO",
] as const;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_ORDER_BY = [{ createdAt: "desc" }, { id: "desc" }] as const;

function normalizeOptionalString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizePagination(params?: ListStockMovementsParams) {
  return {
    page: Math.max(DEFAULT_PAGE, params?.page ?? DEFAULT_PAGE),
    pageSize: Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params?.pageSize ?? DEFAULT_PAGE_SIZE),
    ),
  };
}

function parseBoundaryDate(value?: string, endOfDay = false): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  } else {
    parsed.setHours(0, 0, 0, 0);
  }

  return parsed;
}

function toNumber(value: unknown): number {
  if (value == null) {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  return Number(value) || 0;
}

function movementTypeLabel(tipo: string): string {
  switch (tipo) {
    case "ENTRADA":
      return "Entrada";
    case "COMPRA":
      return "Compra";
    case "SAIDA":
      return "Saida";
    case "AJUSTE":
      return "Ajuste";
    case "DEVOLUCAO":
      return "Devolucao";
    case "QUARENTENA":
      return "Quarentena";
    case "INCINERACAO":
      return "Incineracao";
    default:
      return tipo;
  }
}

function movementOriginLabel(origem?: string | null): string {
  if (!origem) {
    return "Sem origem";
  }

  if (origem.startsWith("REQUISICAO:")) {
    return "Movimento legado";
  }

  switch (origem) {
    case "POS_VENDA":
      return "Venda POS";
    case "ANULACAO_FATURA":
      return "Anulacao de fatura";
    case "COMPRA":
      return "Compra a fornecedor";
    case "COMPRA_FORNECEDOR":
      return "Compra a fornecedor (legado)";
    case "AJUSTE_INVENTARIO":
      return "Ajuste de inventario";
    default:
      return origem
        .toLowerCase()
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
        .join(" ");
  }
}

function movementDocumentReference(row: {
  origem?: string | null;
  idempotencyKey?: string | null;
  observacoes?: string | null;
}): string | null {
  if (row.origem?.startsWith("REQUISICAO:")) {
    const requisicaoId = row.origem.split(":")[1];
    return requisicaoId ? `LEG-${requisicaoId}` : null;
  }

  const invoiceMatch =
    row.idempotencyKey?.match(/EM-FAT-([^-]+(?:-[^-]+)*)-LOTE-/) ??
    row.observacoes?.match(/Fatura\s+#?([A-Za-z0-9/-]+)/i);
  if (invoiceMatch?.[1]) {
    return invoiceMatch[1];
  }

  return null;
}

function buildMovementWhere(params: ListStockMovementsParams) {
  const q = normalizeOptionalString(params.q);
  const tipo = normalizeOptionalString(params.tipo);
  const origem = normalizeOptionalString(params.origem);
  const dataInicio = parseBoundaryDate(params.dataInicio);
  const dataFim = parseBoundaryDate(params.dataFim, true);

  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (tipo) {
    where.tipo = tipo;
  }

  if (origem) {
    where.origem = origem;
  }

  if (params.produtoId) {
    where.produtoId = BigInt(params.produtoId);
  }

  if (params.loteId) {
    where.loteId = BigInt(params.loteId);
  }

  if (dataInicio || dataFim) {
    where.createdAt = {
      ...(dataInicio ? { gte: dataInicio } : {}),
      ...(dataFim ? { lte: dataFim } : {}),
    };
  }

  if (q) {
    where.OR = [
      { origem: { contains: q } },
      { observacoes: { contains: q } },
      { produto: { nomeComercial: { contains: q } } },
      { produto: { barcode: { contains: q } } },
      { lote: { numeroLote: { contains: q } } },
      { user: { name: { contains: q } } },
      ...(/^\d+$/.test(q)
        ? [
            { id: BigInt(q) },
            { produtoId: BigInt(q) },
            { loteId: BigInt(q) },
          ]
        : []),
    ];
  }

  return where;
}

function buildAggregateSummary(result?: StockMovementAggregateRow) {
  return {
    count: result?._count?._all ?? 0,
    quantidade: toNumber(result?._sum?.quantidade),
  };
}

export class ListStockMovementsUseCase {
  async execute(params?: ListStockMovementsParams) {
    const prisma = getPrisma() as any;
    const { page, pageSize } = normalizePagination(params);

    const where = buildMovementWhere(params ?? {});
    const originOptionsWhere =
      normalizeOptionalString(params?.origem) == null
        ? where
        : buildMovementWhere({ ...params, origem: undefined });

    const [
      totalCount,
      items,
      entradaAggregate,
      saidaAggregate,
      ajusteAggregate,
      devolucaoAggregate,
      quarentenaAggregate,
      incineracaoAggregate,
      origemRows,
    ] = await prisma.$transaction([
      prisma.estoqueMovimento.count({ where }),
      prisma.estoqueMovimento.findMany({
        where,
        select: {
          id: true,
          tipo: true,
          quantidade: true,
          estoqueAnterior: true,
          estoqueFinal: true,
          origem: true,
          observacoes: true,
          idempotencyKey: true,
          createdAt: true,
          produto: {
            select: {
              id: true,
              nomeComercial: true,
              barcode: true,
            },
          },
          lote: {
            select: {
              id: true,
              numeroLote: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: DEFAULT_ORDER_BY,
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
      prisma.estoqueMovimento.aggregate({
        where: { ...where, tipo: "ENTRADA" },
        _count: { _all: true },
        _sum: { quantidade: true },
      }),
      prisma.estoqueMovimento.aggregate({
        where: { ...where, tipo: "SAIDA" },
        _count: { _all: true },
        _sum: { quantidade: true },
      }),
      prisma.estoqueMovimento.aggregate({
        where: { ...where, tipo: "AJUSTE" },
        _count: { _all: true },
        _sum: { quantidade: true },
      }),
      prisma.estoqueMovimento.aggregate({
        where: { ...where, tipo: "DEVOLUCAO" },
        _count: { _all: true },
        _sum: { quantidade: true },
      }),
      prisma.estoqueMovimento.aggregate({
        where: { ...where, tipo: "QUARENTENA" },
        _count: { _all: true },
        _sum: { quantidade: true },
      }),
      prisma.estoqueMovimento.aggregate({
        where: { ...where, tipo: "INCINERACAO" },
        _count: { _all: true },
        _sum: { quantidade: true },
      }),
      prisma.estoqueMovimento.findMany({
        where: originOptionsWhere,
        distinct: ["origem"],
        select: { origem: true },
        orderBy: { origem: "asc" },
      }),
    ]);

    const mappedItems = items.slice(0, pageSize).map((item: any) => ({
      id: item.id.toString(),
      tipo: item.tipo,
      tipoLabel: movementTypeLabel(item.tipo),
      quantidade: toNumber(item.quantidade),
      estoqueAnterior: toNumber(item.estoqueAnterior),
      estoqueFinal: toNumber(item.estoqueFinal),
      origem: item.origem ?? null,
      origemLabel: movementOriginLabel(item.origem),
      documentoReferencia: movementDocumentReference(item),
      observacoes: item.observacoes ?? null,
      createdAt: item.createdAt.toISOString(),
      produto: item.produto
        ? {
            id: item.produto.id.toString(),
            nome: item.produto.nomeComercial,
            barcode: item.produto.barcode ?? null,
          }
        : null,
      lote: item.lote
        ? {
            id: item.lote.id.toString(),
            numeroLote: item.lote.numeroLote,
          }
        : null,
      user: item.user
        ? {
            id: item.user.id.toString(),
            nome: item.user.name,
          }
        : null,
    }));

    const overview = {
      totalMovimentos: totalCount,
      entradas: buildAggregateSummary(entradaAggregate),
      saidas: buildAggregateSummary(saidaAggregate),
      ajustes: buildAggregateSummary(ajusteAggregate),
      devolucoes: buildAggregateSummary(devolucaoAggregate),
      quarentenas: buildAggregateSummary(quarentenaAggregate),
      incineracoes: buildAggregateSummary(incineracaoAggregate),
    };

    return {
      items: mappedItems,
      page,
      pageSize,
      hasMore: items.length > pageSize,
      overview,
      filters: {
        tipos: MOVEMENT_TYPES.map((tipo) => ({
          value: tipo,
          label: movementTypeLabel(tipo),
        })),
        origens: origemRows
          .map((row: { origem?: string | null }) => row.origem)
          .filter((origem: string | null | undefined): origem is string =>
            Boolean(origem && origem.trim()),
          )
          .map((origem: string) => ({
            value: origem,
            label: movementOriginLabel(origem),
          })),
      },
    };
  }
}
