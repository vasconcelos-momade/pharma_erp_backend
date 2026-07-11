import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { round2, toNumber } from "../../../../dashboard/application/dashboard-date.util";
import { resolveDashboardPeriod } from "../../../../dashboard/application/dashboard-period.util";
import { enrichLotesStockFromMovements } from "../../../domain/enrich-lote-stock.util";
import { readLoteDisponivel } from "../../../domain/lote-stock-read.util";
import { resolveUltimoPrecoCompra } from "../../../domain/purchase-price.util";
import { buildProdutoDisponivelMap } from "../../../domain/resolve-produto-disponivel.util";

const DEFAULT_COVERAGE_DAYS = 30;

type SuggestionRow = {
  loteId: string;
  numeroLote: string;
  produtoId: string;
  produtoNome: string;
  categoriaNome: string;
  fornecedorId: string | null;
  fornecedorNome: string;
  quantidadeDisponivel: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  consumoMedioDiario: number;
  consumoUltimosDias: number;
  coberturaDias: number;
  quantidadeSugerida: number;
  ultimoPreco: number;
  valorEstimado: number;
  unidade: string;
  dataValidade: string | null;
};

type ProdutoContext = {
  id: bigint;
  nomeComercial: string;
  estoqueMinimo: unknown;
  apresentacao: string | null;
  stockBalance?: { quantidadeDisponivel?: unknown } | null;
  categoria: { nome: string } | null;
  fornecedores: Array<{
    fornecedorPrincipal: boolean;
    precoCompra: unknown;
    fornecedor: { id: bigint; nome: string } | null;
  }>;
  historicoPrecos: Array<{ precoNovo: unknown; data: Date }>;
  lotes: Array<{ precoCompra: unknown; createdAt: Date }>;
};

export class PurchaseSuggestionsUseCase {
  async execute(
    params: {
      days?: number;
      from?: string;
      to?: string;
      coberturaDias?: number;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const prisma = getPrisma() as any;
    const resolved = resolveDashboardPeriod(params);
    const coberturaDias = params.coberturaDias ?? DEFAULT_COVERAGE_DAYS;
    const periodDays = Math.max(1, resolved.days);
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

    const lotes = await prisma.lote.findMany({
      where: {
        deletedAt: null,
        ativo: true,
        movimentos: { some: { deletedAt: null } },
        produto: {
          deletedAt: null,
          ativo: true,
          estoqueMinimo: { gt: 0 },
        },
      },
      include: {
        produto: {
          select: {
            id: true,
            nomeComercial: true,
            estoqueMinimo: true,
            apresentacao: true,
            stockBalance: { select: { quantidadeDisponivel: true } },
            categoria: { select: { nome: true } },
            fornecedores: {
              select: {
                fornecedorPrincipal: true,
                precoCompra: true,
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
        },
        fornecedor: { select: { id: true, nome: true } },
        stockBalance: true,
      },
      orderBy: [{ produto: { nomeComercial: "asc" } }, { dataValidade: "asc" }, { id: "asc" }],
    });

    await enrichLotesStockFromMovements(prisma, lotes);

    const stockByProduto = new Map<string, number>();
    const lotesByProduto = new Map<string, typeof lotes>();
    const produtoById = new Map<string, ProdutoContext>();

    for (const lote of lotes) {
      const produtoId = lote.produtoId.toString();
      const disponivel = readLoteDisponivel(lote);
      stockByProduto.set(produtoId, (stockByProduto.get(produtoId) ?? 0) + disponivel);

      const bucket = lotesByProduto.get(produtoId) ?? [];
      bucket.push(lote);
      lotesByProduto.set(produtoId, bucket);

      if (lote.produto) {
        produtoById.set(produtoId, lote.produto as ProdutoContext);
      }
    }

    const estoqueAtualByProduto = await buildProdutoDisponivelMap(
      prisma,
      [...produtoById.values()],
    );

    const produtoIds = [...stockByProduto.keys()].map((id) => BigInt(id));
    const consumoRows =
      produtoIds.length === 0
        ? []
        : await prisma.faturaItem.groupBy({
            by: ["produtoId"],
            where: {
              produtoId: { in: produtoIds },
              fatura: {
                deletedAt: null,
                estado: { in: ["EMITIDA", "PAGA", "PARCIAL"] },
                createdAt: { gte: resolved.from, lte: resolved.to },
              },
            },
            _sum: { quantidade: true },
          });

    const consumoMap = new Map<string, number>();
    for (const row of consumoRows) {
      if (!row.produtoId) continue;
      consumoMap.set(row.produtoId.toString(), toNumber(row._sum.quantidade));
    }

    const suggestionByProduto = new Map<string, Omit<SuggestionRow, "loteId" | "numeroLote" | "quantidadeDisponivel" | "dataValidade">>();
    let produtosAbaixoMinimo = 0;
    let produtosSemStock = 0;

    for (const [produtoId, estoqueAtualLotes] of stockByProduto.entries()) {
      const produto = produtoById.get(produtoId);
      if (!produto) continue;
      const estoqueAtual = round2(
        estoqueAtualByProduto.get(produtoId) ?? estoqueAtualLotes,
      );

      const estoqueMinimo = toNumber(produto.estoqueMinimo);
      if (estoqueAtual <= estoqueMinimo) {
        produtosAbaixoMinimo += 1;
      }
      if (estoqueAtual <= 0) {
        produtosSemStock += 1;
      }

      if (estoqueAtual > estoqueMinimo) {
        continue;
      }

      const consumoUltimosDias = consumoMap.get(produtoId) ?? 0;
      const consumoMedioDiario = consumoUltimosDias / periodDays;
      const quantidadeSugerida = Math.max(
        0,
        consumoMedioDiario * coberturaDias + estoqueMinimo - estoqueAtual,
      );

      if (quantidadeSugerida <= 0) {
        continue;
      }

      const fornecedorPrincipal =
        produto.fornecedores.find((row) => row.fornecedorPrincipal)?.fornecedor ??
        produto.fornecedores[0]?.fornecedor ??
        null;

      const ultimoPreco = resolveUltimoPrecoCompra({
        fornecedores: produto.fornecedores,
        historicoPrecos: produto.historicoPrecos,
        lotes: produto.lotes,
      });

      suggestionByProduto.set(produtoId, {
        produtoId,
        produtoNome: produto.nomeComercial,
        categoriaNome: produto.categoria?.nome ?? "—",
        fornecedorId: fornecedorPrincipal?.id?.toString() ?? null,
        fornecedorNome: fornecedorPrincipal?.nome ?? "Sem fornecedor",
        estoqueAtual: round2(estoqueAtual),
        estoqueMinimo: round2(estoqueMinimo),
        consumoMedioDiario: round2(consumoMedioDiario),
        consumoUltimosDias: round2(consumoUltimosDias),
        coberturaDias,
        quantidadeSugerida: round2(quantidadeSugerida),
        ultimoPreco: round2(ultimoPreco),
        valorEstimado: round2(quantidadeSugerida * ultimoPreco),
        unidade: produto.apresentacao?.trim() || "un",
      });
    }

    const suggestions: SuggestionRow[] = [];
    for (const [produtoId, suggestion] of suggestionByProduto.entries()) {
      const produtoLotes = lotesByProduto.get(produtoId) ?? [];
      for (const lote of produtoLotes) {
        suggestions.push({
          ...suggestion,
          loteId: lote.id.toString(),
          numeroLote: lote.numeroLote,
          quantidadeDisponivel: round2(readLoteDisponivel(lote)),
          dataValidade: lote.dataValidade?.toISOString?.() ?? null,
          fornecedorId: lote.fornecedor?.id?.toString() ?? suggestion.fornecedorId,
          fornecedorNome: lote.fornecedor?.nome ?? suggestion.fornecedorNome,
        });
      }
    }

    suggestions.sort((a, b) => {
      const byProduto = a.produtoNome.localeCompare(b.produtoNome);
      if (byProduto !== 0) return byProduto;
      return a.numeroLote.localeCompare(b.numeroLote);
    });

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

    const uniqueProdutos = suggestionByProduto.size;
    const quantidadeTotalSugerida = round2(
      [...suggestionByProduto.values()].reduce((sum, item) => sum + item.quantidadeSugerida, 0),
    );
    const valorEstimadoCompra = round2(
      [...suggestionByProduto.values()].reduce((sum, item) => sum + item.valorEstimado, 0),
    );
    const totalCount = suggestions.length;
    const offset = (page - 1) * pageSize;
    const pageItems = suggestions.slice(offset, offset + pageSize);

    return {
      periodo: {
        from: resolved.from.toISOString(),
        to: resolved.to.toISOString(),
        days: resolved.days,
      },
      coberturaDias,
      dashboard: {
        produtosAbaixoMinimo,
        produtosSemStock,
        valorEstimadoCompra,
        quantidadeTotalSugerida,
        fornecedoresEnvolvidos: grouped.size,
        lotesComMovimentacao: lotes.length,
        produtosSugeridos: uniqueProdutos,
      },
      totalCount,
      page,
      pageSize,
      hasMore: offset + pageSize < totalCount,
      totalItens: totalCount,
      items: pageItems,
      groupedByFornecedor: Array.from(grouped.entries()).map(([fornecedorId, value]) => ({
        fornecedorId: fornecedorId === "sem-fornecedor" ? null : fornecedorId,
        fornecedorNome: value.fornecedorNome,
        items: value.items,
      })),
    };
  }
}
