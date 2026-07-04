import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { flattenProdutoForApi } from "../../../products/domain/produto-presenter";
import {
  getQuantidadeDisponivel,
} from "../../../stock/domain/produto-stock.service";
import { consumeStockFefo } from "../../../stock/domain/fefo-allocation.service";
import { replaceItemLoteAllocations } from "../../../sales/domain/fatura-item-lote.service";

export interface CreateSaleDTO {
  clienteId: string;
  userId: string;
  items: {
    produtoId: string;
    quantidade: number;
    receita?: {
      numero?: string;
      medicoNome?: string;
      dataReceita?: string;
    };
  }[];
}

export class CreateSaleUseCase {
  async execute(data: CreateSaleDTO) {
    const prisma = getPrisma();

    return await prisma.$transaction(async (tx) => {
      const results: Array<{
        produtoId: string;
        nome: string;
        quantidade: number;
        preco: number;
        custoUnitario: number;
        lotesUtilizados: Array<{ loteId: bigint; quantidade: number }>;
      }> = [];
      let totalGeral = 0;

      for (const item of data.items) {
        const produtoId = BigInt(item.produtoId);
        const produtoRow = await tx.produto.findUnique({
          where: { id: produtoId },
          include: { regulacao: true },
        });

        if (!produtoRow) {
          throw new Error(`Produto ${item.produtoId} não encontrado`);
        }

        const produto = flattenProdutoForApi(produtoRow as Record<string, unknown>);

        this.validarRegrasDispensacao(produto, item.receita);

        const disponivel = await getQuantidadeDisponivel(tx, produtoId);
        if (disponivel < item.quantidade) {
          throw new Error(`Stock insuficiente para o produto ${produto.nomeComercial}`);
        }

        await tx.$executeRaw`SELECT id FROM produtos WHERE id = ${produtoId} FOR UPDATE`;
        await tx.$executeRaw`SELECT id FROM lotes WHERE produtoId = ${produtoId} AND deletedAt IS NULL FOR UPDATE`;

        const { allocations, totalCusto } = await consumeStockFefo(tx, {
          produtoId: produtoRow.id,
          userId: BigInt(data.userId),
          quantidade: item.quantidade,
          origem: "VENDA",
          idempotencyKeyPrefix: `SALE-${Date.now()}-${produtoId}`,
        });

        const lotesUtilizados = allocations.map((a) => ({
          loteId: a.lote.id,
          quantidade: a.quantidade,
        }));

        const precoMedio =
          allocations.reduce(
            (sum, a) =>
              sum + Number(a.lote.precoVenda ?? 0) * a.quantidade,
            0,
          ) / item.quantidade;
        const custoMedio = totalCusto / item.quantidade;
        const totalItem = precoMedio * item.quantidade;

        if (produto.tipoDispensacao !== "VENDA_LIVRE") {
          await tx.dispensacao.create({
            data: {
              produtoId: produtoRow.id,
              loteId: lotesUtilizados[0]?.loteId ?? produtoRow.id,
              userId: BigInt(data.userId),
              quantidade: item.quantidade,
              tipoDispensacao: produto.tipoDispensacao as any,
              necessitaReceita: true,
              receitaVerificada: !!item.receita,
            },
          });

          if (produto.requiresPsychotropicBook) {
            const now = new Date();
            await tx.livroPsicotropico.create({
              data: {
                produtoId: produtoRow.id,
                responsavelId: BigInt(data.userId),
                tipoMovimento: "SAIDA",
                quantidade: item.quantidade,
                saldoAnterior: disponivel,
                saldoAtual: disponivel - item.quantidade,
                numeroDocumento: item.receita?.numero || "RECEITA_INTERNA",
                observacoes: `Venda para cliente ${data.clienteId}`,
              },
            });
          }
        }

        totalGeral += totalItem;
        results.push({
          produtoId: produtoRow.id.toString(),
          nome: produtoRow.nomeComercial,
          quantidade: item.quantidade,
          preco: precoMedio,
          custoUnitario: custoMedio,
          lotesUtilizados,
        });
      }

      const fatura = await tx.fatura.create({
        data: {
          numero: `FT-${Date.now()}`,
          serie: "2026",
          clienteId: BigInt(data.clienteId),
          userId: BigInt(data.userId),
          subtotal: totalGeral,
          ivaTotal: totalGeral * 0.16,
          total: totalGeral * 1.16,
          estado: "EMITIDA",
          items: {
            create: results.map((r) => ({
              produtoId: BigInt(r.produtoId),
              descricao: r.nome,
              quantidade: r.quantidade,
              precoUnit: r.preco,
              custoUnitario: r.custoUnitario,
              lucroUnitario: Number(r.preco) - Number(r.custoUnitario),
              iva: 16,
              total: Number(r.preco) * r.quantidade * 1.16,
            })),
          },
        },
        include: { items: true },
      });

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const faturaItem = fatura.items[i];
        await replaceItemLoteAllocations(tx, faturaItem.id, result.lotesUtilizados);
      }

      return {
        faturaId: fatura.id.toString(),
        numero: fatura.numero,
        total: fatura.total.toString(),
        itens: results.map((r) => ({
          produtoId: r.produtoId,
          nome: r.nome,
          quantidade: r.quantidade,
          preco: r.preco,
          custoUnitario: r.custoUnitario,
          loteId: r.lotesUtilizados[0]?.loteId.toString(),
        })),
      };
    });
  }

  private validarRegrasDispensacao(
    produto: ReturnType<typeof flattenProdutoForApi>,
    receita?: CreateSaleDTO["items"][0]["receita"],
  ) {
    if (produto.tipoDispensacao === "NARCOTICO") {
      if (!receita?.numero) {
        throw new Error(
          `[ANARME] Bloqueio: Narcóticos exigem receita especial e registo obrigatório.`,
        );
      }
    }

    if (
      produto.tipoDispensacao === "PSICOTROPICO" &&
      !receita?.numero
    ) {
      throw new Error(
        `[ANARME] Bloqueio: Psicotrópicos exigem receita controlada.`,
      );
    }
  }
}
