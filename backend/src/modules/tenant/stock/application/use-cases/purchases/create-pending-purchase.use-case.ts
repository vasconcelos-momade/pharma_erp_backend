import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";

export class CreatePendingPurchaseUseCase {
  async execute(data: { fornecedorId: string; userId: string }) {
    const prisma = getPrisma();

    const fornecedor = await prisma.fornecedor.findUnique({
      where: { id: BigInt(data.fornecedorId) },
    });

    if (!fornecedor) {
      throw new Error(`Fornecedor ${data.fornecedorId} não encontrado`);
    }

    const compra = await prisma.compra.create({
      data: {
        fornecedorId: fornecedor.id,
        data: new Date(),
        total: 0,
        status: "PENDENTE",
      },
    });

    return {
      id: compra.id.toString(),
      fornecedorId: compra.fornecedorId.toString(),
      fornecedorNome: fornecedor.nome,
      status: compra.status,
      total: Number(compra.total),
      createdAt: compra.createdAt.toISOString(),
      itemCount: 0,
    };
  }
}
