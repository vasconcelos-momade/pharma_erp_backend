import { getPrisma } from "../../../../infrastructure/prisma/tenant-prisma.factory";
import { round2, toNumber } from "./dashboard-date.util";
import {
  buildPagedTableResult,
  normalizeTablePagination,
} from "./dashboard-pagination.util";

export type ListContasReceberParams = {
  status?: string;
  clienteId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortDir?: "asc" | "desc";
};

export class ListContasReceberUseCase {
  async execute(params: ListContasReceberParams = {}) {
    const prisma = getPrisma() as any;
    const { page, pageSize } = normalizeTablePagination(params);
    const search = params.search?.trim();
    const sortDir = params.sortDir === "asc" ? "asc" : "desc";

    const where: Record<string, unknown> = {};
    if (params.status) {
      where.status = params.status;
    }
    if (params.clienteId) {
      where.clienteId = BigInt(params.clienteId);
    }
    if (search) {
      where.cliente = { nome: { contains: search, mode: "insensitive" } };
    }

    const [totalCount, rows] = await prisma.$transaction([
      prisma.contaReceber.count({ where }),
      prisma.contaReceber.findMany({
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
          cliente: { select: { id: true, nome: true } },
          fatura: { select: { numero: true } },
        },
      }),
    ]);

    return buildPagedTableResult({
      table: "contasReceber",
      page,
      pageSize,
      totalCount,
      rows: rows.map((row: any) => ({
        id: row.id.toString(),
        clienteId: row.cliente?.id?.toString() ?? null,
        clienteNome: row.cliente?.nome ?? "—",
        faturaNumero: row.fatura?.numero ?? "—",
        valor: round2(toNumber(row.valor)),
        saldo: round2(toNumber(row.saldo)),
        status: row.status,
        vencimento: row.vencimento?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  }
}
