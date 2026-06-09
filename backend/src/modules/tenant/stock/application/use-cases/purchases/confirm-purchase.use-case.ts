import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ValidationApiError } from "../../../../../../shared/http/api-error";
import { receivePurchaseItemStock } from "../../../domain/purchase-receiving.service";

export class ConfirmPurchaseUseCase {
  async execute(compraId: string, userId: string, _confirmData?: unknown) {
    const prisma = getPrisma();

    return await prisma.$transaction(async (tx: any) => {
      const compra = await tx.compra.findUnique({
        where: { id: BigInt(compraId) },
        include: { itens: true },
      });

      if (!compra) throw new Error(`Compra ${compraId} não encontrada`);
      if (compra.status !== "PENDENTE") {
        throw new Error(`A compra já está no status ${compra.status}`);
      }
      if (compra.itens.length === 0) {
        throw new ValidationApiError(`A compra ${compraId} deve possuir pelo menos um item`);
      }

      for (const item of compra.itens) {
        await receivePurchaseItemStock(tx, {
          produtoId: item.produtoId,
          fornecedorId: compra.fornecedorId,
          numeroLote: item.numeroLote ?? "",
          dataValidade: item.dataValidade ?? "",
          quantidade: Number(item.quantidade),
          precoCompra: Number(item.precoCompra),
          precoVenda: item.precoVenda != null ? Number(item.precoVenda) : null,
          userId: BigInt(userId),
        }, {
          salePriceMode: "nullish",
        });
      }

      await tx.compra.update({
        where: { id: compra.id },
        data: { status: "RECEBIDA" },
      });

      return {
        message: "Compra confirmada com sucesso",
        compraId: compra.id.toString(),
        numeroDocumento: compra.numeroDocumento,
        total: Number(compra.total),
      };
    });
  }
}
