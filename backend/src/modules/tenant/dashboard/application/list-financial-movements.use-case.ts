import { getPrisma } from "../../../../infrastructure/prisma/tenant-prisma.factory";
import { round2, toNumber } from "./dashboard-date.util";
import {
  buildPagedTableResult,
  normalizeTablePagination,
} from "./dashboard-pagination.util";
import { resolveDashboardPeriod } from "./dashboard-period.util";

export type ListFinancialMovementsParams = {
  days?: number;
  period?: string;
  from?: string;
  to?: string;
  types?: string[];
  search?: string;
  page?: number;
  pageSize?: number;
  sortDir?: "asc" | "desc";
};

export class ListFinancialMovementsUseCase {
  async execute(params: ListFinancialMovementsParams = {}) {
    const prisma = getPrisma() as any;
    const resolved = resolveDashboardPeriod(params);
    const { page, pageSize } = normalizeTablePagination(params);
    const search = params.search?.trim();
    const sortDir = params.sortDir === "asc" ? "asc" : "desc";

    const where: Record<string, unknown> = {
      deletedAt: null,
      createdAt: { gte: resolved.from, lte: resolved.to },
    };

    if (params.types?.length) {
      where.type = { in: params.types };
    }

    if (search) {
      where.OR = [
        { reference: { contains: search, mode: "insensitive" } },
        { type: { contains: search, mode: "insensitive" } },
      ];
    }

    const [totalCount, rows] = await prisma.$transaction([
      prisma.financialMovement.count({ where }),
      prisma.financialMovement.findMany({
        where,
        orderBy: { createdAt: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
        select: {
          id: true,
          amount: true,
          type: true,
          reference: true,
          createdAt: true,
        },
      }),
    ]);

    return buildPagedTableResult({
      table: "financialMovements",
      page,
      pageSize,
      totalCount,
      rows: rows.map((row: any) => ({
        id: row.id.toString(),
        valor: round2(toNumber(row.amount)),
        tipo: row.type,
        referencia: row.reference ?? "—",
        createdAt: row.createdAt.toISOString(),
      })),
    });
  }
}
