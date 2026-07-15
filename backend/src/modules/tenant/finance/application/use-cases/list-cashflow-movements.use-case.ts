import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  buildPagedTableResult,
  normalizeTablePagination,
} from "../../../dashboard/application/dashboard-pagination.util";
import { round2, toNumber } from "../../../dashboard/application/dashboard-date.util";
import { resolveDashboardPeriod } from "../../../dashboard/application/dashboard-period.util";

export type ListCashflowMovementsParams = {
  days?: number;
  period?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortDir?: "asc" | "desc";
  sortBy?: string;
};

/** Lista movimentos operacionais da tabela `caixa_movimentos`. */
export class ListCashflowMovementsUseCase {
  async execute(params: ListCashflowMovementsParams = {}) {
    const prisma = getPrisma();
    const resolved = resolveDashboardPeriod(params);
    const { page, pageSize } = normalizeTablePagination(params);
    const search = params.search?.trim();
    const sortDir = params.sortDir === "asc" ? "asc" : "desc";
    const sortBy =
      params.sortBy === "valor" ||
      params.sortBy === "tipo" ||
      params.sortBy === "saldoAnterior" ||
      params.sortBy === "saldoFinal"
        ? params.sortBy
        : "createdAt";

    const where: Record<string, unknown> = {
      deletedAt: null,
      createdAt: { gte: resolved.from, lte: resolved.to },
    };

    if (search) {
      where.descricao = { contains: search };
    }

    const [totalCount, rows] = await prisma.$transaction([
      prisma.caixaMovimento.count({ where: where as never }),
      prisma.caixaMovimento.findMany({
        where: where as never,
        orderBy: { [sortBy]: sortDir } as never,
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
        select: {
          id: true,
          tipo: true,
          valor: true,
          saldoAnterior: true,
          saldoFinal: true,
          descricao: true,
          createdAt: true,
        },
      }),
    ]);

    return buildPagedTableResult({
      table: "caixaMovimentos",
      page,
      pageSize,
      totalCount,
      rows: rows.map((row) => ({
        id: row.id.toString(),
        data: row.createdAt.toISOString(),
        tipo: row.tipo,
        valor: round2(toNumber(row.valor)),
        saldoAnterior: round2(toNumber(row.saldoAnterior)),
        saldoFinal: round2(toNumber(row.saldoFinal)),
        descricao: row.descricao?.trim() || "—",
      })),
    });
  }
}
