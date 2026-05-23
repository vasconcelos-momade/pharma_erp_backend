import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { flattenProdutoForApi } from "../../../products/domain/produto-presenter";
import {
  applyStockSaleDelta,
  getQuantidadeDisponivel,
  getQuantidadeTotal,
} from "../../../stock/domain/produto-stock.service";

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
      const results = [];
      let totalGeral = 0;

      for (const item of data.items) {
        const produtoId = BigInt(item.produtoId);
        const produtoRow = await tx.produto.findUnique({
          where: { id: produtoId },
          include: {
            regulacao: true,
            lotes: {
              where: {
                ativo: true,
                quantidadeAtual: { gt: 0 },
                dataValidade: { gt: new Date() },
              },
              orderBy: { dataValidade: "asc" },
            },
          },
        });

        if (!produtoRow) {
          throw new Error(`Produto ${item.produtoId} não encontrado`);
        }

        const produto = flattenProdutoForApi(produtoRow as Record<string, unknown>);

        this.validarRegrasDispensacao(produto, item.receita);

        const disponivel = await getQuantidadeDisponivel(tx, produtoId);
        if (disponivel < item.quantidade) {
          throw new Error(`Stock insuficiente para o produto ${produto.nome}`);
        }

        let quantidadeRestante = item.quantidade;
        const lotesUtilizados = [];

        for (const lote of produtoRow.lotes) {
          if (quantidadeRestante <= 0) break;

          const qtdATirar = Math.min(Number(lote.quantidadeAtual), quantidadeRestante);

          await tx.lote.update({
            where: { id: lote.id },
            data: { quantidadeAtual: { decrement: qtdATirar } },
          });

          lotesUtilizados.push({ loteId: lote.id, quantidade: qtdATirar });
          quantidadeRestante -= qtdATirar;
        }

        if (quantidadeRestante > 0) {
          throw new Error(
            `Não foi possível satisfazer a quantidade do produto ${produto.nome} com os lotes disponíveis`,
          );
        }

        const estoqueAnterior = await getQuantidadeTotal(tx, produtoId);
        await applyStockSaleDelta(tx, produtoId, item.quantidade);
        const estoqueFinal = estoqueAnterior - item.quantidade;

        await tx.estoqueMovimento.create({
          data: {
            produtoId: produtoRow.id,
            userId: BigInt(data.userId),
            tipo: "SAIDA",
            quantidade: item.quantidade,
            estoqueAnterior,
            estoqueFinal,
            origem: "VENDA",
          },
        });

        if (produto.tipoDispensacao !== "VENDA_LIVRE") {
          await tx.dispensacao.create({
            data: {
              produtoId: produtoRow.id,
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
                mes: now.getMonth() + 1,
                ano: now.getFullYear(),
                produtoId: produtoRow.id,
                responsavelId: BigInt(data.userId),
                tipoMovimento: "SAIDA",
                quantidade: item.quantidade,
                numeroDocumento: item.receita?.numero || "RECEITA_INTERNA",
                observacoes: `Venda para cliente ${data.clienteId}`,
              },
            });
          }
        }

        totalGeral += Number(produtoRow.precoVenda) * item.quantidade;
        results.push({
          produtoId: produtoRow.id.toString(),
          nome: produtoRow.nome,
          quantidade: item.quantidade,
          preco: produtoRow.precoVenda,
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
              iva: 16,
              total: Number(r.preco) * r.quantidade * 1.16,
            })),
          },
        },
      });

      return {
        faturaId: fatura.id.toString(),
        numero: fatura.numero,
        total: fatura.total.toString(),
        itens: results,
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
      !receita
    ) {
      throw new Error(`[ANARME] Bloqueio: Psicotrópicos exigem receita controlada.`);
    }

    if (
      produto.tipoDispensacao === "RECEITA_CONTROLADA" ||
      produto.tipoDispensacao === "RECEITA_SIMPLES" ||
      produto.tipoDispensacao === "RECEITA_OBRIGATORIA"
    ) {
      if (!receita) {
        throw new Error(`Este medicamento exige apresentação de receita.`);
      }
    }
  }
}
