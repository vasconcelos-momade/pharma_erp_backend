import { getPrisma } from "../../../../infrastructure/prisma/tenant-prisma.factory";
import { round2, toNumber } from "./dashboard-date.util";
import {
  buildPagedTableResult,
  normalizeTablePagination,
} from "./dashboard-pagination.util";

export type ListContasPagarParams = {
  status?: string;
  fornecedorId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortDir?: "asc" | "desc";
};

export class ListContasPagarUseCase {
  async execute(params: ListContasPagarParams = {}) {
    const prisma = getPrisma() as any;
    const { page, pageSize } = normalizeTablePagination(params);
    const search = params.search?.trim();
    const sortDir = params.sortDir === "asc" ? "asc" : "desc";

    const where: Record<string, unknown> = {};
    if (params.status) {
      where.status = params.status;
    }
    if (params.fornecedorId) {
      where.fornecedorId = BigInt(params.fornecedorId);
    }
    if (search) {
      where.fornecedor = { nome: { contains: search, mode: "insensitive" } };
    }

    const [totalCount, rows] = await prisma.$transaction([
      prisma.contaPagar.count({ where }),
      prisma.contaPagar.findMany({
        where,
        orderBy: [{ vencimento: sortDir }, { id: sortDir }],
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
        select: {
          id: true,
          valor: true,
          saldo: true,
          status: true,
          vencimento: true,
          createdAt: true,
          fornecedor: { select: { id: true, nome: true } },
        },
      }),
    ]);

    return buildPagedTableResult({
      table: "contasPagar",
      page,
      pageSize,
      totalCount,
      rows: rows.map((row: any) => ({
        id: row.id.toString(),
        fornecedorId: row.fornecedor?.id?.toString() ?? null,
        fornecedorNome: row.fornecedor?.nome ?? "—",
        valor: round2(toNumber(row.valor)),
        saldo: round2(toNumber(row.saldo)),
        status: row.status,
        vencimento: row.vencimento?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  }
}
