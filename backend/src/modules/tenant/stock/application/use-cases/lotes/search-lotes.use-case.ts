import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { enrichLotesStockFromMovements } from "../../../domain/enrich-lote-stock.util";
import { mapLoteListItem } from "./lote.mapper";

type SearchLotesParams = {
  q?: string;
  produtoId?: string;
  fornecedorId?: string;
  estadoSanitario?: string;
  disponibilidade?: string;
  validadeAte?: string;
  validadeDe?: string;
  expirado?: boolean;
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

export class LotesDashboardUseCase {
  async execute() {
    const prisma = getPrisma() as any;
    const now = new Date();
    const from30Days = new Date(now);
    from30Days.setDate(from30Days.getDate() - 30);

    const loteBaseWhere = {
      deletedAt: null,
      ativo: true,
    };

    const [
      totalLotes,
      lotesDisponiveis,
      lotesExpirados,
      lotesReservados,
      lotesSanitarios,
      movimentosSanitarios30Dias,
      incineracoes30Dias,
    ] = await prisma.$transaction([
      prisma.lote.count({
        where: loteBaseWhere,
      }),
      prisma.lote.count({
        where: {
          ...loteBaseWhere,
          stockBalance: { quantidadeDisponivel: { gt: 0 } },
          disponibilidade: "DISPONIVEL",
          estadoSanitario: "VALIDO",
          dataValidade: { gte: now },
        },
      }),
      prisma.lote.count({
        where: {
          ...loteBaseWhere,
          stockBalance: { quantidadeTotal: { gt: 0 } },
          dataValidade: { lt: now },
        },
      }),
      prisma.lote.count({
        where: {
          ...loteBaseWhere,
          reservas: { some: {} },
        },
      }),
      prisma.lote.count({
        where: {
          ...loteBaseWhere,
          OR: [
            { estadoSanitario: { in: ["RECALL", "EXPIRADO"] } },
            { disponibilidade: { in: ["BLOQUEADO", "INDISPONIVEL"] } },
            { quantidadeQuarentena: { gt: 0 } },
          ],
        },
      }),
      prisma.estoqueMovimento.count({
        where: {
          deletedAt: null,
          tipo: { in: ["QUARENTENA", "INCINERACAO"] },
          createdAt: { gte: from30Days },
        },
      }),
      prisma.incineracao.count({
        where: {
          createdAt: { gte: from30Days },
        },
      }),
    ]);

    return {
      totalLotes,
      lotesDisponiveis,
      lotesExpirados,
      lotesReservados,
      lotesSanitarios,
      movimentosSanitarios30Dias,
      incineracoes30Dias,
      alertasOperacionais: lotesExpirados + lotesSanitarios + lotesReservados,
    };
  }
}

export class SearchLotesUseCase {
  async execute(params: SearchLotesParams = {}) {
    const prisma = getPrisma() as any;
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const now = new Date();
    const q = params.q?.trim();

    const where: Record<string, unknown> = {
      deletedAt: null,
      ativo: true,
    };

    if (params.produtoId) where.produtoId = BigInt(params.produtoId);
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

    if (q) {
      where.OR = [
        { numeroLote: { contains: q } },
        { produto: { nomeComercial: { contains: q } } },
        { produto: { barcode: { contains: q } } },
        { fornecedor: { nome: { contains: q } } },
        ...(/^\d+$/.test(q) ? [{ id: BigInt(q) }, { produtoId: BigInt(q) }] : []),
      ];
    }

    const sortBy = params.sortBy ?? "dataValidade";
    const sortOrder = params.sortOrder === "desc" ? "desc" : "asc";
    const orderBy =
      sortBy === "numeroLote"
        ? [{ numeroLote: sortOrder }, { id: sortOrder }]
        : sortBy === "quantidadeAtual"
          ? [
              { stockBalance: { quantidadeTotal: sortOrder } },
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
          produto: { select: { id: true, nomeComercial: true, barcode: true } },
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
      items: pageRows.map((lote: any) => mapLoteListItem(lote, now)),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }
}
