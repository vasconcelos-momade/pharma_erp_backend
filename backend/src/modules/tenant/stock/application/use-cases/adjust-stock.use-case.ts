import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  getQuantidadeTotalFromMovements,
  syncStockBalanceCache,
} from "../../domain/produto-stock.service";
import { syncLoteStockBalanceCache } from "../../domain/lote-stock.service";

export interface AdjustStockDTO {
  produtoId: string;
  loteId?: string;
  userId: string;
  quantidade: number;
  motivo: string;
}

export class AdjustStockUseCase {
  async execute(data: AdjustStockDTO) {
    const prisma = getPrisma();

    return await prisma.$transaction(async (tx: any) => {
      const produtoId = BigInt(data.produtoId);
      await tx.$executeRaw`SELECT id FROM produtos WHERE id = ${produtoId} FOR UPDATE`;

      const produto = await tx.produto.findUnique({ where: { id: produtoId } });
      if (!produto) {
        throw new Error("Produto não encontrado");
      }

      const estoqueAnterior = await getQuantidadeTotalFromMovements(tx, produtoId);

      if (data.loteId) {
        const loteId = BigInt(data.loteId);
        await tx.$executeRaw`SELECT id FROM lotes WHERE id = ${loteId} FOR UPDATE`;
        const lote = await tx.lote.findUnique({ where: { id: loteId } });
        if (!lote) throw new Error("Lote não encontrado");
      }

      const novoEstoque = estoqueAnterior + data.quantidade;

      await tx.estoqueMovimento.create({
        data: {
          produtoId,
          loteId: data.loteId ? BigInt(data.loteId) : null,
          userId: BigInt(data.userId),
          tipo: "AJUSTE",
          quantidade: Math.abs(data.quantidade),
          estoqueAnterior,
          estoqueFinal: novoEstoque,
          origem: "AJUSTE_INVENTARIO",
          observacoes: data.motivo,
        },
      });

      if (data.loteId) {
        const lote = await tx.lote.findUnique({
          where: { id: BigInt(data.loteId) },
          select: { id: true, quantidadeQuarentena: true },
        });
        if (lote) {
          await syncLoteStockBalanceCache(tx, lote);
        }
      }

      await syncStockBalanceCache(tx, produtoId);

      await tx.produto.update({
        where: { id: produtoId },
        data: { version: { increment: 1 } },
      });

      return {
        message: "Stock ajustado com sucesso",
        novoEstoque,
      };
    });
  }
}
