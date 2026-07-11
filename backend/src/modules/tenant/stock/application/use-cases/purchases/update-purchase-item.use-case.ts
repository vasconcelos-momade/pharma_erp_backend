import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import type { AddPurchaseItemDTO } from "../../dto/purchases.dto";

export class UpdatePurchaseItemUseCase {
  async execute(compraId: string, itemId: string, data: AddPurchaseItemDTO) {
    const prisma = getPrisma();
    const compraPk = BigInt(compraId);
    const itemPk = BigInt(itemId);

    const compra = await prisma.compra.findUnique({
      where: { id: compraPk },
    });

    if (!compra) {
      throw new Error(`Compra ${compraId} não encontrada`);
    }

    if (compra.status !== "PENDENTE") {
      throw new Error(`A compra ${compraId} já foi finalizada ou cancelada e não pode ser alterada`);
    }

    const item = await prisma.compraItem.findFirst({
      where: {
        id: itemPk,
        compraId: compraPk,
      },
    });

    if (!item) {
      throw new Error(`Item ${itemId} não encontrado na compra ${compraId}`);
    }

    const produto = await prisma.produto.findUnique({
      where: { id: BigInt(data.produtoId) },
    });

    if (!produto) {
      throw new Error(`Produto ${data.produtoId} não encontrado`);
    }

    const duplicateItem = await prisma.compraItem.findFirst({
      where: {
        compraId: compraPk,
        produtoId: produto.id,
        id: { not: itemPk },
      },
    });

    if (duplicateItem) {
      throw new Error(`O produto ${data.produtoId} já está presente nesta compra`);
    }

    const quantidadeAprovada = data.quantidadeAprovada;
    const quantidadeSugerida = data.quantidadeSugerida ?? quantidadeAprovada;
    const subtotal = quantidadeAprovada * data.precoCompra;

    await prisma.compraItem.update({
      where: { id: itemPk },
      data: {
        produtoId: produto.id,
        numeroLote: data.numeroLote,
        dataValidade: new Date(data.dataValidade),
        quantidadeSugerida,
        quantidadeAprovada,
        precoCompra: data.precoCompra,
        precoVenda: data.precoVenda ?? null,
        total: subtotal,
      },
    });

    const items = await prisma.compraItem.findMany({
      where: { compraId: compraPk },
    });
    const novoTotal = items.reduce((acc: number, curr) => acc + Number(curr.total), 0);

    await prisma.compra.update({
      where: { id: compraPk },
      data: { total: novoTotal },
    });

    const { GetPurchaseDetailUseCase } = await import("./get-purchase-detail.use-case");
    return new GetPurchaseDetailUseCase().execute(compraId);
  }
}
