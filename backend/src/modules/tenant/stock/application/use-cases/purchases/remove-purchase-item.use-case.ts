import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";

export class RemovePurchaseItemUseCase {
  async execute(compraId: string, itemId: string) {
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
      throw new Error(`A compra ${compraId} não pode ser alterada no status ${compra.status}`);
    }

    await prisma.compraItem.delete({
      where: { id: itemPk },
    });

    const items = await prisma.compraItem.findMany({
      where: { compraId: compraPk },
    });

    const total = items.reduce((accumulator: number, item: any) => {
      return accumulator + Number(item.total);
    }, 0);

    await prisma.compra.update({
      where: { id: compraPk },
      data: { total },
    });

    const { GetPurchaseDetailUseCase } = await import("./get-purchase-detail.use-case");
    return new GetPurchaseDetailUseCase().execute(compraId);
  }
}
