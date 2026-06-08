import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  applyStockReturnDelta,
  getQuantidadeTotal,
} from "../../domain/produto-stock.service";

function getUtcDayRange(value: string): { start: Date; end: Date } {
  const start = new Date(value);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

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
        const { start: dataValidadeInicio, end: dataValidadeFim } = getUtcDayRange(
          item.dataValidade,
        );
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
            numeroLote: item.numeroLote,
            dataValidade: dataValidadeInicio,
            quantidade: item.quantidade,
            precoCompra: item.precoCompra,
            precoVenda: item.precoVenda ?? null,
            total: subtotalItem,
          },
        });

        const precoVendaLote = item.precoVenda || produto.precoVenda;
        const loteExistente = await tx.lote.findFirst({
          where: {
            produtoId: produto.id,
            numeroLote: item.numeroLote,
            dataValidade: {
              gte: dataValidadeInicio,
              lt: dataValidadeFim,
            },
            deletedAt: null,
          },
        });

        const lote = loteExistente
          ? await tx.lote.update({
              where: { id: loteExistente.id },
              data: {
                quantidadeInicial: { increment: item.quantidade },
                quantidadeAtual: { increment: item.quantidade },
                fornecedorId: loteExistente.fornecedorId ?? BigInt(data.fornecedorId),
                precoCompra: item.precoCompra,
                precoVenda: precoVendaLote,
                ativo: true,
              },
            })
          : await tx.lote.create({
              data: {
                produtoId: produto.id,
                fornecedorId: BigInt(data.fornecedorId),
                numeroLote: item.numeroLote,
                dataValidade: dataValidadeInicio,
                quantidadeInicial: item.quantidade,
                quantidadeAtual: item.quantidade,
                precoCompra: item.precoCompra,
                precoVenda: precoVendaLote,
                ativo: true,
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
        numeroDocumento: compra.numeroDocumento,
        total: totalCompra,
      };
    });
  }
}
