import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  applyStockReturnDelta,
  getQuantidadeTotal,
} from "../../domain/produto-stock.service";

export interface ReceivePurchaseDTO {
  fornecedorId: string;
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
          fornecedorId: BigInt(data.fornecedorId),
          data: new Date(),
          total: 0,
          status: "RECEBIDA",
        },
      });

      for (const item of data.items) {
        const produtoId = BigInt(item.produtoId);
        const produto = await tx.produto.findUnique({
          where: { id: produtoId },
        });

        if (!produto) {
          throw new Error(`Produto ${item.produtoId} não encontrado`);
        }

        const subtotalItem = item.quantidade * item.precoCompra;
        totalCompra += subtotalItem;

        await tx.compraItem.create({
          data: {
            compraId: compra.id,
            produtoId: produto.id,
            quantidade: item.quantidade,
            preco: item.precoCompra,
            total: subtotalItem,
          },
        });

        const lote = await tx.lote.create({
          data: {
            produtoId: produto.id,
            fornecedorId: BigInt(data.fornecedorId),
            numeroLote: item.numeroLote,
            dataValidade: new Date(item.dataValidade),
            quantidadeInicial: item.quantidade,
            quantidadeAtual: item.quantidade,
            precoCompra: item.precoCompra,
            precoVenda: item.precoVenda || produto.precoVenda,
            status: "ATIVO",
          },
        });

        if (item.precoVenda) {
          await tx.produto.update({
            where: { id: produto.id },
            data: { precoVenda: item.precoVenda },
          });
        }

        const estoqueAnterior = await getQuantidadeTotal(tx, produtoId);
        const estoqueFinal = await applyStockReturnDelta(tx, produtoId, item.quantidade);

        await tx.estoqueMovimento.create({
          data: {
            produtoId: produto.id,
            loteId: lote.id,
            userId: BigInt(data.userId),
            tipo: "ENTRADA",
            quantidade: item.quantidade,
            estoqueAnterior,
            estoqueFinal,
            origem: "COMPRA_FORNECEDOR",
          },
        });

        await tx.historicoPreco.create({
          data: {
            produtoId: produto.id,
            fornecedorId: BigInt(data.fornecedorId),
            precoAnterior: produto.precoVenda,
            precoNovo: item.precoVenda || produto.precoVenda,
            variacao: item.precoVenda
              ? Number(item.precoVenda) - Number(produto.precoVenda)
              : 0,
          },
        });
      }

      await tx.compra.update({
        where: { id: compra.id },
        data: { total: totalCompra },
      });

      return {
        message: "Compra recebida e stock atualizado com sucesso",
        compraId: compra.id.toString(),
        total: totalCompra,
      };
    });
  }
}
