import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { round2, toNumber } from "../../../../dashboard/application/dashboard-date.util";
import { resolveUltimoPrecoCompra } from "../../../domain/purchase-price.util";
import {
  resolvePrincipalSupplierId,
  resolvePrincipalSupplierName,
} from "../../../domain/purchase-supplier.util";
import { DEFAULT_COVERAGE_DAYS } from "../../../domain/purchase-suggestion.service";

type SuggestionListItem = {
  id: string;
  produtoId: string;
  produtoNome: string;
  categoriaNome: string;
  fornecedorId: string | null;
  fornecedorNome: string;
  estoqueAtual: number;
  estoqueMinimo: number;
  consumoMedioDiario: number;
  coberturaDias: number;
  quantidadeSugerida: number;
  ultimoPreco: number;
  valorEstimado: number;
  unidade: string;
  origem: "AUTOMATICA" | "MANUAL";
  observacao: string | null;
  generatedAt: string;
  updatedAt: string;
};

const SORTABLE_FIELDS = new Set([
  "produtoNome",
  "estoqueAtual",
  "estoqueMinimo",
  "consumoMedioDiario",
  "quantidadeSugerida",
  "origem",
  "fornecedorNome",
]);

export class PurchaseSuggestionsUseCase {
  async execute(
    params: {
      q?: string;
      origem?: "AUTOMATICA" | "MANUAL" | "TODAS";
      supplierId?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const prisma = getPrisma() as any;
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const search = params.q?.trim();
    const origemFilter =
      params.origem && params.origem !== "TODAS" ? params.origem : undefined;
    const sortBy = SORTABLE_FIELDS.has(params.sortBy ?? "")
      ? params.sortBy!
      : "produtoNome";
    const sortOrder = params.sortOrder === "desc" ? "desc" : "asc";
    const supplierFilter = params.supplierId?.trim()
      ? BigInt(params.supplierId)
      : undefined;

    const where: Record<string, unknown> = {
      produto: {
        deletedAt: null,
        ativo: true,
        ...(search
          ? {
              OR: [
                { nomeComercial: { contains: search } },
                { nomeGenerico: { contains: search } },
                { barcode: { contains: search } },
              ],
            }
          : {}),
      },
      ...(origemFilter ? { origem: origemFilter } : {}),
      ...(supplierFilter != null ? { supplierId: supplierFilter } : {}),
    };

    const orderBy = this.buildOrderBy(sortBy, sortOrder);

    const produtoPriceSelect = {
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
    };

    const [totalCount, suggestions, allForDashboard] = await Promise.all([
      prisma.purchaseSuggestion.count({ where }),
      prisma.purchaseSuggestion.findMany({
        where,
        include: {
          fornecedor: { select: { id: true, nome: true } },
          produto: {
            select: {
              id: true,
              nomeComercial: true,
              apresentacao: true,
              categoria: { select: { nome: true } },
              ...produtoPriceSelect,
            },
          },
        },
        orderBy,
        skip: offset,
        take: pageSize,
      }),
      prisma.purchaseSuggestion.findMany({
        where,
        select: {
          quantidadeAtual: true,
          quantidadeSugerida: true,
          supplierId: true,
          produto: { select: produtoPriceSelect },
        },
      }),
    ]);

    const items: SuggestionListItem[] = suggestions.map((row: any) =>
      this.mapRow(row),
    );

    let produtosSemStock = 0;
    let quantidadeTotalSugerida = 0;
    let valorEstimadoCompra = 0;
    const fornecedores = new Set<string>();

    for (const row of allForDashboard) {
      const estoqueAtual = round2(toNumber(row.quantidadeAtual));
      if (estoqueAtual <= 0) produtosSemStock += 1;

      const quantidadeSugerida = round2(toNumber(row.quantidadeSugerida));
      quantidadeTotalSugerida += quantidadeSugerida;

      const ultimoPreco = resolveUltimoPrecoCompra({
        fornecedores: row.produto.fornecedores,
        historicoPrecos: row.produto.historicoPrecos,
        lotes: row.produto.lotes,
      });
      valorEstimadoCompra += quantidadeSugerida * ultimoPreco;

      const supplierKey =
        row.supplierId?.toString() ??
        resolvePrincipalSupplierId(row.produto.fornecedores)?.toString();
      if (supplierKey) {
        fornecedores.add(supplierKey);
      }
    }

    const grouped = new Map<string, { fornecedorNome: string; items: SuggestionListItem[] }>();
    for (const item of items) {
      const key = item.fornecedorId ?? "sem-fornecedor";
      const bucket = grouped.get(key) ?? {
        fornecedorNome: item.fornecedorNome,
        items: [],
      };
      bucket.items.push(item);
      grouped.set(key, bucket);
    }

    return {
      coberturaDias: DEFAULT_COVERAGE_DAYS,
      dashboard: {
        produtosAbaixoMinimo: totalCount,
        produtosSemStock,
        valorEstimadoCompra: round2(valorEstimadoCompra),
        quantidadeTotalSugerida: round2(quantidadeTotalSugerida),
        fornecedoresEnvolvidos: fornecedores.size,
        produtosSugeridos: totalCount,
      },
      totalCount,
      page,
      pageSize,
      hasMore: offset + pageSize < totalCount,
      totalItens: totalCount,
      items,
      groupedByFornecedor: Array.from(grouped.entries())
        .map(([fornecedorId, value]) => ({
          fornecedorId: fornecedorId === "sem-fornecedor" ? null : fornecedorId,
          fornecedorNome: value.fornecedorNome,
          items: value.items,
        }))
        .sort((a, b) => a.fornecedorNome.localeCompare(b.fornecedorNome)),
    };
  }

  private mapRow(row: any): SuggestionListItem {
    const produto = row.produto;
    const fornecedorId =
      row.supplierId?.toString() ??
      row.fornecedor?.id?.toString() ??
      resolvePrincipalSupplierId(produto.fornecedores)?.toString() ??
      null;
    const fornecedorNome = resolvePrincipalSupplierName(
      produto.fornecedores,
      row.fornecedor,
    );
    const ultimoPreco = resolveUltimoPrecoCompra({
      fornecedores: produto.fornecedores,
      historicoPrecos: produto.historicoPrecos,
      lotes: produto.lotes,
    });
    const quantidadeSugerida = round2(toNumber(row.quantidadeSugerida));

    return {
      id: row.id.toString(),
      produtoId: row.produtoId.toString(),
      produtoNome: produto.nomeComercial,
      categoriaNome: produto.categoria?.nome ?? "—",
      fornecedorId,
      fornecedorNome,
      estoqueAtual: round2(toNumber(row.quantidadeAtual)),
      estoqueMinimo: round2(toNumber(row.estoqueMinimo)),
      consumoMedioDiario: round2(toNumber(row.consumoMedioDiario)),
      coberturaDias: row.coberturaDias ?? DEFAULT_COVERAGE_DAYS,
      quantidadeSugerida,
      ultimoPreco: round2(ultimoPreco),
      valorEstimado: round2(quantidadeSugerida * ultimoPreco),
      unidade: produto.apresentacao?.trim() || "un",
      origem: row.origem,
      observacao: row.observacao ?? null,
      generatedAt: row.generatedAt?.toISOString?.() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  private buildOrderBy(sortBy: string, sortOrder: "asc" | "desc") {
    switch (sortBy) {
      case "estoqueAtual":
        return { quantidadeAtual: sortOrder };
      case "estoqueMinimo":
        return { estoqueMinimo: sortOrder };
      case "consumoMedioDiario":
        return { consumoMedioDiario: sortOrder };
      case "quantidadeSugerida":
        return { quantidadeSugerida: sortOrder };
      case "origem":
        return { origem: sortOrder };
      case "fornecedorNome":
        return { fornecedor: { nome: sortOrder } };
      case "produtoNome":
      default:
        return { produto: { nomeComercial: sortOrder } };
    }
  }
}
