import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  loadValorStockLotesFromMovements,
  sumValorStockFromLotes,
} from "../../../../dashboard/application/dashboard-valor-stock.util";
import { round2 } from "../../../../dashboard/application/dashboard-date.util";
import { enrichLotesStockFromMovements } from "../../../domain/enrich-lote-stock.util";
import {
  LOTE_COM_STOCK_DISPONIVEL_WHERE,
  LOTE_COM_STOCK_TOTAL_WHERE,
} from "../../../domain/lote-stock-read.util";
import { mapEstoqueListItem } from "./estoque.mapper";

type SearchEstoqueParams = {
  q?: string;
  categoriaId?: string;
  fornecedorId?: string;
  estadoSanitario?: string;
  disponibilidade?: string;
  semStock?: boolean;
  aExpirar?: boolean;
  expirado?: boolean;
  validadeAte?: string;
  validadeDe?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
};

function parseDate(value?: string, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (endOfDay) parsed.setHours(23, 59, 59, 999);
  else parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function applyEstadoSanitarioFilter(
  where: Record<string, unknown>,
  value: string,
): void {
  switch (value) {
    case "VALIDO":
    case "RECALL":
    case "EXPIRADO":
      where.estadoSanitario = value;
      break;
    case "QUARENTENA":
      where.quantidadeQuarentena = { gt: 0 };
      break;
    case "BLOQUEADO":
      where.disponibilidade = "BLOQUEADO";
      break;
    default:
      break;
  }
}

function applyDisponibilidadeFilter(
  where: Record<string, unknown>,
  value: string,
): void {
  switch (value) {
    case "DISPONIVEL":
    case "BLOQUEADO":
    case "INDISPONIVEL":
      where.disponibilidade = value;
      break;
    case "RESERVADO":
      where.reservas = { some: {} };
      break;
    default:
      break;
  }
}

export class EstoqueDashboardUseCase {
  async execute() {
    const prisma = getPrisma() as any;
    const now = new Date();
    const expirarLimite = new Date(now);
    expirarLimite.setDate(expirarLimite.getDate() + 60);

    const loteBaseWhere = {
      deletedAt: null,
      ativo: true,
    };

    const [
      produtosEmStock,
      lotesAtivos,
      produtosSemStock,
      lotesAExpirar,
      lotesExpirados,
      lotesEmRecall,
      lotesEmQuarentena,
      lotesIncinerados,
    ] = await prisma.$transaction([
      prisma.produto.count({
        where: {
          deletedAt: null,
          ativo: true,
          OR: [
            { stockBalance: { quantidadeDisponivel: { gt: 0 } } },
            {
              lotes: {
                some: {
                  deletedAt: null,
                  ativo: true,
                  ...LOTE_COM_STOCK_DISPONIVEL_WHERE,
                },
              },
            },
          ],
        },
      }),
      prisma.lote.count({ where: loteBaseWhere }),
      prisma.produto.count({
        where: {
          deletedAt: null,
          ativo: true,
          OR: [
            { stockBalance: { is: { quantidadeDisponivel: { lte: 0 } } } },
            { stockBalance: { is: null } },
          ],
          NOT: {
            lotes: {
              some: {
                deletedAt: null,
                ativo: true,
                ...LOTE_COM_STOCK_DISPONIVEL_WHERE,
              },
            },
          },
        },
      }),
      prisma.lote.count({
        where: {
          ...loteBaseWhere,
          dataValidade: { gte: now, lte: expirarLimite },
          ...LOTE_COM_STOCK_TOTAL_WHERE,
        },
      }),
      prisma.lote.count({
        where: {
          ...loteBaseWhere,
          dataValidade: { lt: now },
          ...LOTE_COM_STOCK_TOTAL_WHERE,
        },
      }),
      prisma.lote.count({
        where: {
          ...loteBaseWhere,
          estadoSanitario: "RECALL",
        },
      }),
      prisma.lote.count({
        where: {
          ...loteBaseWhere,
          quantidadeQuarentena: { gt: 0 },
          estadoSanitario: { not: "RECALL" },
        },
      }),
      prisma.lote.count({
        where: {
          ...loteBaseWhere,
          quantidadeIncinerada: { gt: 0 },
          OR: [
            { stockBalance: { is: null } },
            { stockBalance: { quantidadeTotal: { lte: 0 } } },
          ],
          quantidadeQuarentena: { lte: 0 },
        },
      }),
    ]);

    const valorStockRows = await loadValorStockLotesFromMovements(prisma, now);
    const valorTotalInventario = sumValorStockFromLotes(valorStockRows);

    return {
      produtosEmStock,
      lotesAtivos,
      produtosSemStock,
      lotesAExpirar,
      lotesExpirados,
      lotesEmRecall,
      lotesEmQuarentena,
      lotesIncinerados,
      valorTotalInventario: round2(valorTotalInventario),
    };
  }
}

export class SearchEstoqueUseCase {
  async execute(params: SearchEstoqueParams = {}) {
    const prisma = getPrisma() as any;
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
    const now = new Date();
    const expirarLimite = new Date(now);
    expirarLimite.setDate(expirarLimite.getDate() + 60);
    const q = params.q?.trim();

    const where: Record<string, unknown> = {
      deletedAt: null,
      ativo: true,
    };

    if (params.categoriaId) {
      where.produto = { categoriaId: BigInt(params.categoriaId) };
    }
    if (params.fornecedorId) where.fornecedorId = BigInt(params.fornecedorId);
    if (params.estadoSanitario) {
      applyEstadoSanitarioFilter(where, params.estadoSanitario);
    }
    if (params.disponibilidade) {
      applyDisponibilidadeFilter(where, params.disponibilidade);
    }

    const validadeDe = parseDate(params.validadeDe);
    const validadeAte = parseDate(params.validadeAte, true);
    if (validadeDe || validadeAte) {
      where.dataValidade = {
        ...(validadeDe ? { gte: validadeDe } : {}),
        ...(validadeAte ? { lte: validadeAte } : {}),
      };
    }

    if (params.expirado === true) {
      where.dataValidade = { lt: now };
    } else if (params.expirado === false) {
      where.dataValidade = { gte: now };
    }

    if (params.aExpirar === true) {
      where.dataValidade = { gte: now, lte: expirarLimite };
    }

    if (params.semStock === true) {
      const semStockFilter = {
        OR: [
          { stockBalance: { is: null } },
          { stockBalance: { quantidadeDisponivel: { lte: 0 } } },
        ],
      };
      if (Array.isArray(where.AND)) {
        where.AND.push(semStockFilter);
      } else {
        where.AND = [semStockFilter];
      }
    }

    if (q) {
      where.OR = [
        { numeroLote: { contains: q } },
        { produto: { nomeComercial: { contains: q } } },
        { produto: { nomeGenerico: { contains: q } } },
        { produto: { barcode: { contains: q } } },
        { fornecedor: { nome: { contains: q } } },
        ...(/^\d+$/.test(q)
          ? [{ id: BigInt(q) }, { produtoId: BigInt(q) }]
          : []),
      ];
    }

    const sortBy = params.sortBy ?? "dataValidade";
    const sortOrder = params.sortOrder === "desc" ? "desc" : "asc";
    const orderBy =
      sortBy === "numeroLote"
        ? [{ numeroLote: sortOrder }, { id: sortOrder }]
        : sortBy === "quantidadeAtual"
          ? [
              { stockBalance: { quantidadeDisponivel: sortOrder } },
              { dataValidade: "asc" },
            ]
          : sortBy === "updatedAt"
            ? [
                { stockBalance: { lastUpdated: sortOrder } },
                { dataValidade: "asc" },
              ]
            : sortBy === "createdAt"
              ? [{ createdAt: sortOrder }, { id: sortOrder }]
              : [{ dataValidade: sortOrder }, { numeroLote: "asc" }];

    const [totalCount, rows] = await prisma.$transaction([
      prisma.lote.count({ where }),
      prisma.lote.findMany({
        where,
        include: {
          produto: {
            select: {
              id: true,
              nomeComercial: true,
              nomeGenerico: true,
              barcode: true,
              dosagem: true,
              forma: true,
              estoqueMinimo: true,
              categoriaId: true,
              categoria: { select: { id: true, nome: true } },
            },
          },
          fornecedor: { select: { id: true, nome: true } },
          stockBalance: true,
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
    ]);

    const pageRows = rows.slice(0, pageSize);
    await enrichLotesStockFromMovements(prisma, pageRows);

    return {
      items: pageRows.map((lote: any) => mapEstoqueListItem(lote, now)),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }
}
