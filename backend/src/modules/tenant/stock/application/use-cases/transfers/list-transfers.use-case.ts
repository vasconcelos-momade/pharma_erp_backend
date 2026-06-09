import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";

export interface ListTransfersInput {
  status?: "RASCUNHO" | "CONFIRMADA" | "CANCELADA";
  origem?: string;
  destino?: string;
}

export class ListTransfersUseCase {
  async execute(filters: ListTransfersInput) {
    const prisma = getPrisma() as any;

    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.origem) where.origem = filters.origem.trim();
    if (filters.destino) where.destino = filters.destino.trim();

    const transferencias = await prisma.transferencia.findMany({
      where,
      include: {
        itens: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return transferencias.map((transferencia: any) => ({
      id: transferencia.id.toString(),
      numeroDocumento: transferencia.numeroDocumento,
      origem: transferencia.origem,
      destino: transferencia.destino,
      tipo: transferencia.tipo,
      status: transferencia.status,
      observacao: transferencia.observacao,
      totalItens: transferencia.itens.length,
      quantidadeTotal: transferencia.itens.reduce(
        (sum: number, item: any) => sum + Number(item.quantidade ?? 0),
        0,
      ),
      createdAt: transferencia.createdAt,
      updatedAt: transferencia.updatedAt,
    }));
  }
}
