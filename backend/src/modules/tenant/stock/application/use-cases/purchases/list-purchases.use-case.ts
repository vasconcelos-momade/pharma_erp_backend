import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";

export class ListPurchasesUseCase {
  async execute(filters: { status?: "PENDENTE" | "RECEBIDA" | "CANCELADA" }) {
    const prisma = getPrisma();

    const compras = await prisma.compra.findMany({
      where: filters.status ? { status: filters.status } : undefined,
      include: {
        fornecedor: true,
        _count: {
          select: { itens: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return compras.map((c: any) => ({
      id: c.id.toString(),
      fornecedorId: c.fornecedorId.toString(),
      fornecedorNome: c.fornecedor.nome,
      status: c.status,
      total: Number(c.total),
      data: c.data.toISOString(),
      createdAt: c.createdAt.toISOString(),
      itemCount: c._count.itens,
    }));
  }
}
