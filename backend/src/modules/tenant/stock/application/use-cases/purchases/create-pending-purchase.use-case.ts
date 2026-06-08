import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import type { CreatePendingPurchaseDTO } from "../../dto/purchases.dto";

export class CreatePendingPurchaseUseCase {
  async execute(data: CreatePendingPurchaseDTO & { userId: string }) {
    const prisma = getPrisma();
    const numeroDocumento = data.numeroDocumento.trim();

    const fornecedor = await prisma.fornecedor.findUnique({
      where: { id: BigInt(data.fornecedorId) },
    });

    if (!fornecedor) {
      throw new Error(`Fornecedor ${data.fornecedorId} não encontrado`);
    }

    const compra = await prisma.compra.create({
      data: {
        numeroDocumento,
        fornecedorId: fornecedor.id,
        data: new Date(),
        total: 0,
        status: "PENDENTE",
      },
    });

    return {
      id: compra.id.toString(),
      numeroDocumento: compra.numeroDocumento,
      fornecedorId: compra.fornecedorId.toString(),
      fornecedorNome: fornecedor.nome,
      status: compra.status,
      total: Number(compra.total),
      data: compra.data.toISOString(),
      createdAt: compra.createdAt.toISOString(),
      itemCount: 0,
    };
  }
}
