import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";

export class AddPurchaseItemUseCase {
  async execute(compraId: string, data: { produtoId: string; quantidade: number; precoCompra: number; precoVenda?: number; numeroLote: string; dataValidade: string }) {
    const prisma = getPrisma();

    const compra = await prisma.compra.findUnique({
      where: { id: BigInt(compraId) },
    });

    if (!compra) {
      throw new Error(`Compra ${compraId} não encontrada`);
    }

    if (compra.status !== "PENDENTE") {
      throw new Error(`A compra ${compraId} já foi finalizada ou cancelada e não pode receber itens`);
    }

    const produto = await prisma.produto.findUnique({
      where: { id: BigInt(data.produtoId) },
    });

    if (!produto) {
      throw new Error(`Produto ${data.produtoId} não encontrado`);
    }

    const subtotal = data.quantidade * data.precoCompra;

    // Remove item se já existir para o mesmo produto, substituindo pelo novo
    await prisma.compraItem.deleteMany({
      where: {
        compraId: compra.id,
        produtoId: produto.id,
      },
    });

    const item = await prisma.compraItem.create({
      data: {
        compraId: compra.id,
        produtoId: produto.id,
        numeroLote: data.numeroLote,
        dataValidade: new Date(data.dataValidade),
        quantidade: data.quantidade,
        preco: data.precoCompra,
        total: subtotal,
      },
    });

    const items = await prisma.compraItem.findMany({
      where: { compraId: compra.id },
    });
    const novoTotal = items.reduce((acc: number, curr: any) => acc + Number(curr.total), 0);

    await prisma.compra.update({
      where: { id: compra.id },
      data: { total: novoTotal },
    });

    // Se veio um preço de venda novo, a gente pode atualizar o produto temporariamente ou só usar no confirm
    // Vamos apenas retornar a compra atualizada

    const GetPurchaseDetailUseCase = (await import("./get-purchase-detail.use-case")).GetPurchaseDetailUseCase;
    return new GetPurchaseDetailUseCase().execute(compraId);
  }
}
