import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";

export interface ListFaturasDTO {
  page?: number;
  pageSize?: number;
  search?: string;
  clienteId?: string;
  status?: "RASCUNHO" | "EMITIDA" | "PAGA" | "PARCIAL" | "ANULADA";
  dateFrom?: string;
  dateTo?: string;
  terminalId?: string;
  userId?: string;
}

export class ListFaturasUseCase {
  async execute(params?: ListFaturasDTO) {
    const prisma = getPrisma();
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 20));
    const search = params?.search?.trim() || undefined;
    const clienteId = params?.clienteId?.trim() || undefined;
    const status = params?.status;
    const terminalId = params?.terminalId?.trim() || undefined;
    const userId = params?.userId?.trim() || undefined;

    const createdAtFilter = this.buildCreatedAtFilter(params?.dateFrom, params?.dateTo);

    const where = {
      deletedAt: null,
      ...(status ? { estado: status } : { estado: { not: "RASCUNHO" as const } }),
      ...(clienteId ? { clienteId: BigInt(clienteId) } : {}),
      ...(terminalId ? { terminalId: BigInt(terminalId) } : {}),
      ...(userId ? { userId: BigInt(userId) } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      ...(search
        ? {
            OR: [
              { numero: { contains: search } },
              { cliente: { nome: { contains: search } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.fatura.count({ where }),
      prisma.fatura.findMany({
        where,
        select: {
          id: true,
          numero: true,
          serie: true,
          total: true,
          subtotal: true,
          ivaTotal: true,
          estado: true,
          tipoPagamento: true,
          createdAt: true,
          cancelledAt: true,
          cliente: {
            select: {
              id: true,
              nome: true,
              documento: true,
            },
          },
          terminal: {
            select: {
              id: true,
              nome: true,
              codigo: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
          _count: {
            select: {
              items: true,
              pagamentos: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
    ]);

    const hasMore = rows.length > pageSize;
    const items = rows.slice(0, pageSize).map((row: any) => ({
      id: row.id.toString(),
      numero: row.numero,
      serie: row.serie,
      subtotal: Number(row.subtotal),
      ivaTotal: Number(row.ivaTotal),
      total: Number(row.total),
      estado: row.estado,
      tipoPagamento: row.tipoPagamento,
      createdAt: row.createdAt,
      cancelledAt: row.cancelledAt,
      cliente: row.cliente
        ? {
            id: row.cliente.id.toString(),
            nome: row.cliente.nome,
            documento: row.cliente.documento,
          }
        : null,
      terminal: row.terminal
        ? {
            id: row.terminal.id.toString(),
            nome: row.terminal.nome,
            codigo: row.terminal.codigo,
          }
        : null,
      user: row.user
        ? {
            id: row.user.id.toString(),
            name: row.user.name,
            role: row.user.role,
          }
        : null,
      itemCount: row._count.items,
      paymentCount: row._count.pagamentos,
    }));

    return {
      items,
      page,
      pageSize,
      total,
      hasMore,
    };
  }

  private buildCreatedAtFilter(dateFrom?: string, dateTo?: string) {
    const from = this.parseDateStart(dateFrom);
    const to = this.parseDateEnd(dateTo);

    if (!from && !to) {
      return undefined;
    }

    return {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  private parseDateStart(value?: string) {
    if (!value?.trim()) {
      return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("dateFrom inválida.");
    }

    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  private parseDateEnd(value?: string) {
    if (!value?.trim()) {
      return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("dateTo inválida.");
    }

    parsed.setHours(23, 59, 59, 999);
    return parsed;
  }
}
