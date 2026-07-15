import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  getQuantidadeTotalFromMovements,
  syncStockBalanceCache,
} from "../../domain/produto-stock.service";
import {
  getLoteQuantidadeFromMovements,
  syncLoteStockBalanceCache,
} from "../../domain/lote-stock.service";

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

      const loteId = data.loteId ? BigInt(data.loteId) : null;
      let estoqueAnterior: number;
      let novoEstoque: number;

      if (loteId) {
        await tx.$executeRaw`SELECT id FROM lotes WHERE id = ${loteId} FOR UPDATE`;
        const lote = await tx.lote.findUnique({ where: { id: loteId } });
        if (!lote) throw new Error("Lote não encontrado");
        estoqueAnterior = await getLoteQuantidadeFromMovements(tx, loteId);
        novoEstoque = Math.max(0, estoqueAnterior + data.quantidade);
      } else {
        estoqueAnterior = await getQuantidadeTotalFromMovements(tx, produtoId);
        novoEstoque = Math.max(0, estoqueAnterior + data.quantidade);
      }

      await tx.estoqueMovimento.create({
        data: {
          produtoId,
          loteId,
          userId: BigInt(data.userId),
          tipo: "AJUSTE",
          quantidade: Math.abs(data.quantidade),
          estoqueAnterior,
          estoqueFinal: novoEstoque,
          origem: "AJUSTE_INVENTARIO",
          observacoes: data.motivo,
        },
      });

      if (loteId) {
        const lote = await tx.lote.findUnique({
          where: { id: loteId },
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
