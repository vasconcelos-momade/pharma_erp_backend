import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { resolveTenantEmpresaProfile } from "../services/tenant-empresa-profile.service";

type ListFaturasParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  clienteId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  terminalId?: string;
  userId?: string;
};

function toStartOfDay(value: string): Date | undefined {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toEndOfDay(value: string): Date | undefined {
  const parsed = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export class ListFaturasUseCase {
  async execute(params: ListFaturasParams = {}) {
    const prisma = getPrisma() as any;
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const search = params.search?.trim();
    const status = params.status?.trim().toUpperCase();
    const clienteId = params.clienteId?.trim();
    const terminalId = params.terminalId?.trim();
    const userId = params.userId?.trim();
    const createdAtGte = params.dateFrom ? toStartOfDay(params.dateFrom) : undefined;
    const createdAtLte = params.dateTo ? toEndOfDay(params.dateTo) : undefined;

    const where = {
      deletedAt: null,
      ...(status ? { estado: status as any } : {}),
      ...(clienteId ? { clienteId: BigInt(clienteId) } : {}),
      ...(terminalId ? { terminalId: BigInt(terminalId) } : {}),
      ...(userId ? { userId: BigInt(userId) } : {}),
      ...(createdAtGte || createdAtLte
        ? {
            createdAt: {
              ...(createdAtGte ? { gte: createdAtGte } : {}),
              ...(createdAtLte ? { lte: createdAtLte } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { numero: { contains: search } },
              { serie: { contains: search } },
              { cliente: { nome: { contains: search } } },
              { cliente: { documento: { contains: search } } },
            ],
          }
        : {}),
    };

    const [items, summary, empresa] = await Promise.all([
      prisma.fatura.findMany({
      where,
      select: {
        id: true,
        numero: true,
        serie: true,
        tipo: true,
        subtotal: true,
        ivaTotal: true,
        total: true,
        valorRecebido: true,
        troco: true,
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
      Promise.all([
        prisma.fatura.count({ where }),
        prisma.fatura.count({ where: { ...where, estado: "PAGA" } }),
        prisma.fatura.count({
          where: { ...where, estado: { in: ["EMITIDA", "PARCIAL"] } },
        }),
        prisma.fatura.count({ where: { ...where, estado: "ANULADA" } }),
      ]),
      resolveTenantEmpresaProfile(),
    ]);

    const [totalInvoices, paid, pending, cancelled] = summary;

    return {
      items: items.slice(0, pageSize).map((item: any) => ({
        id: item.id,
        numero: item.numero,
        serie: item.serie,
        tipo: item.tipo,
        documentMode: item.tipo === "FR" ? "thermal_80mm" : "pdf_a4",
        subtotal: item.subtotal,
        ivaTotal: item.ivaTotal,
        total: item.total,
        valorRecebido: item.valorRecebido,
        troco: item.troco,
        estado: item.estado,
        tipoPagamento: item.tipoPagamento,
        empresa,
        createdAt: item.createdAt,
        cancelledAt: item.cancelledAt,
        cliente: item.cliente,
        terminal: item.terminal,
        user: item.user,
        itemCount: item._count.items,
        paymentCount: item._count.pagamentos,
      })),
      page,
      pageSize,
      hasMore: items.length > pageSize,
      summary: {
        total: totalInvoices,
        paid,
        pending,
        cancelled,
      },
    };
  }
}
