import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  getQuantidadeTotalFromMovements,
  syncStockBalanceCache,
} from "../../../domain/produto-stock.service";
import { syncLoteStockBalanceCache } from "../../../domain/lote-stock.service";
import { inventarioItemInclude, mapInventarioDetalhe } from "./inventory.mapper";

export class ReconcileInventoryUseCase {
  async execute(inventarioId: string, userId: string) {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx: any) => {
      const id = BigInt(inventarioId);
      await tx.$executeRaw`SELECT id FROM inventarios WHERE id = ${id} FOR UPDATE`;

      const inventario = await tx.inventario.findUnique({
        where: { id },
        include: { itens: true },
      });

      if (!inventario) {
        throw new Error("Inventário não encontrado");
      }

      if (inventario.status !== "EM_CONTAGEM") {
        throw new Error("Apenas inventários em contagem podem ser reconciliados");
      }

      const itensComDivergencia = inventario.itens.filter(
        (item: { divergencia: unknown }) => Number(item.divergencia) !== 0,
      );

      const produtoIds = [
        ...new Set(
          itensComDivergencia.map((item: { produtoId: bigint }) => item.produtoId.toString()),
        ),
      ].map((pid) => BigInt(pid));

      for (const produtoId of produtoIds) {
        await tx.$executeRaw`SELECT id FROM produtos WHERE id = ${produtoId} FOR UPDATE`;
      }

      for (const produtoId of produtoIds) {
        const estoqueAnterior = await getQuantidadeTotalFromMovements(tx, produtoId);
        const itensProduto = itensComDivergencia.filter(
          (item: { produtoId: bigint }) => item.produtoId === produtoId,
        );

        for (const item of itensProduto) {
          if (!item.loteId) continue;

          await tx.$executeRaw`SELECT id FROM lotes WHERE id = ${item.loteId} FOR UPDATE`;
        }

        const novoEstoque = itensProduto.reduce(
          (sum: number, item: { estoqueContado: unknown }) =>
            sum + Number(item.estoqueContado),
          0,
        );

        if (itensProduto.length > 0) {
          await tx.estoqueMovimento.create({
            data: {
              produtoId,
              loteId: itensProduto[0]?.loteId ?? null,
              userId: BigInt(userId),
              tipo: "AJUSTE",
              quantidade: Math.abs(novoEstoque - estoqueAnterior),
              estoqueAnterior,
              estoqueFinal: novoEstoque,
              origem: "RECONCILIACAO_INVENTARIO",
              observacoes: `Reconciliação Inventário ${inventario.codigo}`,
            },
          });

          await syncStockBalanceCache(tx, produtoId);

          for (const item of itensProduto) {
            if (item.loteId) {
              await syncLoteStockBalanceCache(tx, { id: item.loteId });
            }
          }

          await tx.produto.update({
            where: { id: produtoId },
            data: { version: { increment: 1 } },
          });
        }
      }

      const updated = await tx.inventario.update({
        where: { id },
        data: {
          status: "RECONCILIADO",
          reconciliadoPorId: BigInt(userId),
          reconciliadoEm: new Date(),
        },
        include: {
          iniciadoPor: { select: { id: true, name: true } },
          reconciliadoPor: { select: { id: true, name: true } },
          itens: {
            include: inventarioItemInclude,
            orderBy: [{ produtoId: "asc" }, { loteId: "asc" }],
          },
        },
      });

      return mapInventarioDetalhe(updated);
    });
  }
}
