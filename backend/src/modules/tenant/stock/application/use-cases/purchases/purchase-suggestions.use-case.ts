import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { round2, toNumber } from "../../../../dashboard/application/dashboard-date.util";
import { resolveDashboardPeriod } from "../../../../dashboard/application/dashboard-period.util";

type SuggestionRow = {
  produtoId: string;
  produtoNome: string;
  fornecedorId: string | null;
  fornecedorNome: string;
  consumo: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  pontoReposicao: number;
  quantidadeSugerida: number;
  unidade: string;
};

export class PurchaseSuggestionsUseCase {
  async execute(params: { days?: number; from?: string; to?: string } = {}) {
    const prisma = getPrisma() as any;
    const resolved = resolveDashboardPeriod(params);

    const produtos = await prisma.produto.findMany({
      where: {
        deletedAt: null,
        ativo: true,
        estoqueMinimo: { gt: 0 },
      },
      select: {
        id: true,
        nomeComercial: true,
        estoqueMinimo: true,
        apresentacao: true,
        stockBalance: { select: { quantidadeDisponivel: true } },
        fornecedores: {
          where: { fornecedorPrincipal: true },
          select: {
            fornecedor: { select: { id: true, nome: true } },
          },
          take: 1,
        },
      },
      orderBy: { nomeComercial: "asc" },
      take: 500,
    });

    const produtoIds = produtos.map((row: { id: bigint }) => row.id);
    const consumoRows =
      produtoIds.length === 0
        ? []
        : await prisma.estoqueMovimento.groupBy({
            by: ["produtoId"],
            where: {
              deletedAt: null,
              produtoId: { in: produtoIds },
              tipo: "SAIDA",
              createdAt: { gte: resolved.from, lte: resolved.to },
            },
            _sum: { quantidade: true },
          });

    const consumoMap = new Map<string, number>();
    for (const row of consumoRows) {
      consumoMap.set(row.produtoId.toString(), Math.abs(toNumber(row._sum.quantidade)));
    }

    const suggestions: SuggestionRow[] = [];

    for (const produto of produtos) {
      const estoqueAtual = toNumber(produto.stockBalance?.quantidadeDisponivel);
      const estoqueMinimo = toNumber(produto.estoqueMinimo);
      const pontoReposicao = estoqueMinimo;
      const consumo = consumoMap.get(produto.id.toString()) ?? 0;
      const necessidade = Math.max(0, pontoReposicao + consumo - estoqueAtual);

      if (necessidade <= 0) {
        continue;
      }

      const fornecedorPrincipal = produto.fornecedores[0]?.fornecedor ?? null;
      suggestions.push({
        produtoId: produto.id.toString(),
        produtoNome: produto.nomeComercial,
        fornecedorId: fornecedorPrincipal?.id?.toString() ?? null,
        fornecedorNome: fornecedorPrincipal?.nome ?? "Sem fornecedor",
        consumo: round2(consumo),
        estoqueAtual: round2(estoqueAtual),
        estoqueMinimo: round2(estoqueMinimo),
        pontoReposicao: round2(pontoReposicao),
        quantidadeSugerida: round2(necessidade),
        unidade: produto.apresentacao?.trim() || "un",
      });
    }

    suggestions.sort((a, b) => a.fornecedorNome.localeCompare(b.fornecedorNome));

    const grouped = new Map<string, { fornecedorNome: string; items: SuggestionRow[] }>();
    for (const item of suggestions) {
      const key = item.fornecedorId ?? "sem-fornecedor";
      const bucket = grouped.get(key) ?? {
        fornecedorNome: item.fornecedorNome,
        items: [],
      };
      bucket.items.push(item);
      grouped.set(key, bucket);
    }

    return {
      periodo: {
        from: resolved.from.toISOString(),
        to: resolved.to.toISOString(),
        days: resolved.days,
      },
      totalItens: suggestions.length,
      items: suggestions,
      groupedByFornecedor: Array.from(grouped.entries()).map(([fornecedorId, value]) => ({
        fornecedorId: fornecedorId === "sem-fornecedor" ? null : fornecedorId,
        fornecedorNome: value.fornecedorNome,
        items: value.items,
      })),
    };
  }
}
