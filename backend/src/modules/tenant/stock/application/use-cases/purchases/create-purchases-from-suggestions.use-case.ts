import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ValidationApiError } from "../../../../../../shared/http/api-error";
import { resolveUltimoPrecoCompra } from "../../../domain/purchase-price.util";
import type { CreatePurchasesFromSuggestionsDTO } from "../../dto/purchases.dto";

export class CreatePurchasesFromSuggestionsUseCase {
  async execute(data: CreatePurchasesFromSuggestionsDTO & { userId: string }) {
    const prisma = getPrisma() as any;

    const selectedItems = data.items.filter((item) => item.quantidadeAprovada > 0);
    if (selectedItems.length === 0) {
      throw new ValidationApiError("Nenhum item com quantidade aprovada maior que zero");
    }

    const produtoIds = selectedItems.map((item) => BigInt(item.produtoId));
    const produtos = await prisma.produto.findMany({
      where: { id: { in: produtoIds }, deletedAt: null, ativo: true },
      select: {
        id: true,
        nomeComercial: true,
        fornecedores: {
          select: {
            fornecedorPrincipal: true,
            precoCompra: true,
            fornecedorId: true,
            fornecedor: { select: { id: true, nome: true } },
          },
        },
        historicoPrecos: {
          select: { precoNovo: true, data: true },
          orderBy: { data: "desc" },
          take: 1,
        },
        lotes: {
          select: { precoCompra: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const produtoMap = new Map(produtos.map((row: any) => [row.id.toString(), row]));

    const grouped = new Map<
      string,
      {
        fornecedorId: bigint;
        fornecedorNome: string;
        items: Array<{
          produtoId: bigint;
          quantidadeSugerida: number;
          quantidadeAprovada: number;
          precoCompra: number;
        }>;
      }
    >();

    for (const item of selectedItems) {
      const produto = produtoMap.get(item.produtoId);
      if (!produto) {
        throw new ValidationApiError(`Produto ${item.produtoId} não encontrado`);
      }

      const principal =
        produto.fornecedores.find((row: any) => row.fornecedorPrincipal) ??
        produto.fornecedores[0];

      const fornecedorId = item.fornecedorId
        ? BigInt(item.fornecedorId)
        : principal?.fornecedorId;

      if (!fornecedorId) {
        throw new ValidationApiError(
          `Produto ${produto.nomeComercial} não possui fornecedor principal`,
        );
      }

      const precoCompra = resolveUltimoPrecoCompra({
        fornecedores: produto.fornecedores,
        historicoPrecos: produto.historicoPrecos,
        lotes: produto.lotes,
      });

      const key = fornecedorId.toString();
      const bucket = grouped.get(key) ?? {
        fornecedorId,
        fornecedorNome: principal?.fornecedor?.nome ?? "Fornecedor",
        items: [],
      };

      bucket.items.push({
        produtoId: produto.id,
        quantidadeSugerida: item.quantidadeSugerida,
        quantidadeAprovada: item.quantidadeAprovada,
        precoCompra,
      });
      grouped.set(key, bucket);
    }

    const created = await prisma.$transaction(async (tx: any) => {
      const compras = [];
      const now = Date.now();

      for (const [index, group] of Array.from(grouped.values()).entries()) {
        const numeroDocumento = `SC-${now}-${index + 1}`;
        let total = 0;

        const compra = await tx.compra.create({
          data: {
            numeroDocumento,
            fornecedorId: group.fornecedorId,
            data: new Date(),
            total: 0,
            status: "PENDENTE",
          },
        });

        for (const item of group.items) {
          const subtotal = item.quantidadeAprovada * item.precoCompra;
          total += subtotal;
          await tx.compraItem.create({
            data: {
              compraId: compra.id,
              produtoId: item.produtoId,
              quantidadeSugerida: item.quantidadeSugerida,
              quantidadeAprovada: item.quantidadeAprovada,
              precoCompra: item.precoCompra,
              total: subtotal,
            },
          });
        }

        const updated = await tx.compra.update({
          where: { id: compra.id },
          data: { total },
          include: {
            fornecedor: true,
            _count: { select: { itens: true } },
          },
        });

        compras.push({
          id: updated.id.toString(),
          numeroDocumento: updated.numeroDocumento,
          fornecedorId: updated.fornecedorId.toString(),
          fornecedorNome: updated.fornecedor.nome,
          status: updated.status,
          total: Number(updated.total),
          itemCount: updated._count.itens,
        });
      }

      return compras;
    });

    return {
      message: `${created.length} compra(s) criada(s) com sucesso`,
      compras: created,
    };
  }
}
