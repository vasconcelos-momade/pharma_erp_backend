import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { applyStockReturnDelta, getQuantidadeTotal } from "../../../domain/produto-stock.service";

function getUtcDayRange(value: string): { start: Date; end: Date } {
  const start = new Date(value);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

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

      for (const item of compra.itens) {
        const produto = await tx.produto.findUnique({ where: { id: item.produtoId } });
        const numeroLote = item.numeroLote || `LOTE-${compra.id}-${item.id}`;
        const dataValidade = item.dataValidade
          ? item.dataValidade.toISOString()
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        const { start: dataValidadeInicio, end: dataValidadeFim } = getUtcDayRange(dataValidade);

        const precoVendaLote = item.precoVenda ?? produto.precoVenda;
        const loteExistente = await tx.lote.findFirst({
          where: {
            produtoId: produto.id,
            numeroLote: numeroLote,
            dataValidade: { gte: dataValidadeInicio, lt: dataValidadeFim },
            deletedAt: null,
          },
        });

        const lote = loteExistente
          ? await tx.lote.update({
              where: { id: loteExistente.id },
              data: {
                quantidadeInicial: { increment: item.quantidade },
                quantidadeAtual: { increment: item.quantidade },
                fornecedorId: loteExistente.fornecedorId ?? compra.fornecedorId,
                precoCompra: item.precoCompra,
                precoVenda: precoVendaLote,
                ativo: true,
              },
            })
          : await tx.lote.create({
              data: {
                produtoId: produto.id,
                fornecedorId: compra.fornecedorId,
                numeroLote: numeroLote,
                dataValidade: dataValidadeInicio,
                quantidadeInicial: item.quantidade,
                quantidadeAtual: item.quantidade,
                precoCompra: item.precoCompra,
                precoVenda: precoVendaLote,
                ativo: true,
              },
            });

        if (item.precoVenda != null) {
          await tx.produto.update({
            where: { id: produto.id },
            data: { precoVenda: item.precoVenda },
          });
        }

        const estoqueAnterior = await getQuantidadeTotal(tx, item.produtoId);
        const estoqueFinal = await applyStockReturnDelta(tx, item.produtoId, item.quantidade);

        await tx.estoqueMovimento.create({
          data: {
            produtoId: produto.id,
            loteId: lote.id,
            userId: BigInt(userId),
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
            fornecedorId: compra.fornecedorId,
            precoAnterior: produto.precoVenda,
            precoNovo: precoVendaLote,
            variacao: item.precoVenda != null
              ? Number(item.precoVenda) - Number(produto.precoVenda)
              : 0,
          },
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
