import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  normalizeExpiryDate,
  receivePurchaseItemStock,
} from "../../domain/purchase-receiving.service";

export interface ReceivePurchaseDTO {
  fornecedorId: string;
  numeroDocumento: string;
  userId: string;
  items: {
    produtoId: string;
    numeroLote: string;
    dataValidade: string;
    quantidade: number;
    precoCompra: number;
    precoVenda?: number;
  }[];
}

export class ReceivePurchaseUseCase {
  async execute(data: ReceivePurchaseDTO) {
    const prisma = getPrisma();

    return await prisma.$transaction(async (tx: any) => {
      let totalCompra = 0;

      const compra = await tx.compra.create({
        data: {
          numeroDocumento: data.numeroDocumento.trim(),
          fornecedorId: BigInt(data.fornecedorId),
          data: new Date(),
          total: 0,
          status: "RECEBIDA",
        },
      });

      for (const item of data.items) {
        const produtoId = BigInt(item.produtoId);
        const dataValidade = normalizeExpiryDate(item.dataValidade);

        const subtotalItem = item.quantidade * item.precoCompra;
        totalCompra += subtotalItem;

        await tx.compraItem.create({
          data: {
            compraId: compra.id,
            produtoId,
            numeroLote: item.numeroLote,
            dataValidade,
            quantidade: item.quantidade,
            precoCompra: item.precoCompra,
            precoVenda: item.precoVenda ?? null,
            total: subtotalItem,
          },
        });

        await receivePurchaseItemStock(tx, {
          produtoId,
          fornecedorId: BigInt(data.fornecedorId),
          numeroLote: item.numeroLote,
          dataValidade,
          quantidade: item.quantidade,
          precoCompra: item.precoCompra,
          precoVenda: item.precoVenda ?? null,
          userId: BigInt(data.userId),
        }, {
          salePriceMode: "truthy",
        });
      }

      await tx.compra.update({
        where: { id: compra.id },
        data: { total: totalCompra },
      });

      return {
        message: "Compra recebida e stock atualizado com sucesso",
        compraId: compra.id.toString(),
        numeroDocumento: compra.numeroDocumento,
        total: totalCompra,
      };
    });
  }
}
