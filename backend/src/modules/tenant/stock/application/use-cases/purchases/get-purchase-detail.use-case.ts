import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";

export class GetPurchaseDetailUseCase {
  async execute(compraId: string) {
    const prisma = getPrisma();

    const compra = await prisma.compra.findUnique({
      where: { id: BigInt(compraId) },
      include: {
        fornecedor: true,
        itens: {
          include: {
            produto: true,
          },
        },
      },
    });

    if (!compra) {
      throw new Error(`Compra ${compraId} não encontrada`);
    }

    return {
      id: compra.id.toString(),
      numeroDocumento: compra.numeroDocumento,
      fornecedorId: compra.fornecedorId.toString(),
      fornecedorNome: compra.fornecedor.nome,
      status: compra.status,
      total: Number(compra.total),
      data: compra.data.toISOString(),
      createdAt: compra.createdAt.toISOString(),
      items: compra.itens.map((item: any) => ({
        id: item.id.toString(),
        produtoId: item.produtoId.toString(),
        produtoNome: item.produto.nome,
        numeroLote: item.numeroLote || "",
        dataValidade: item.dataValidade ? item.dataValidade.toISOString() : "",
        quantidade: Number(item.quantidade),
        precoCompra: Number(item.precoCompra),
        precoVenda: item.precoVenda != null ? Number(item.precoVenda) : null,
        subtotal: Number(item.total),
      })),
    };
  }
}
