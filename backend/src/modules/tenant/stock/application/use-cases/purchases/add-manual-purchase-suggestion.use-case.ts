import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ValidationApiError } from "../../../../../../shared/http/api-error";
import { round2, toNumber } from "../../../../dashboard/application/dashboard-date.util";
import { DEFAULT_COVERAGE_DAYS } from "../../../domain/purchase-suggestion.service";
import type { AddManualPurchaseSuggestionDTO } from "../../dto/suppliers.dto";

export class AddManualPurchaseSuggestionUseCase {
  async execute(data: AddManualPurchaseSuggestionDTO) {
    const prisma = getPrisma() as any;
    const produtoId = BigInt(data.produtoId);

    const produto = await prisma.produto.findFirst({
      where: { id: produtoId, deletedAt: null, ativo: true },
      include: { stockBalance: { select: { quantidadeDisponivel: true } } },
    });

    if (!produto) {
      throw new ValidationApiError("Produto não encontrado ou inactivo");
    }

    const estoqueAtual = round2(toNumber(produto.stockBalance?.quantidadeDisponivel));
    const estoqueMinimo = round2(toNumber(produto.estoqueMinimo));

    const suggestion = await prisma.purchaseSuggestion.upsert({
      where: { produtoId },
      create: {
        produtoId,
        quantidadeAtual: estoqueAtual,
        estoqueMinimo,
        consumoMedioDiario: 0,
        quantidadeSugerida: round2(data.quantidadeSugerida),
        coberturaDias: DEFAULT_COVERAGE_DAYS,
        origem: "MANUAL",
        observacao: data.observacao?.trim() || null,
      },
      update: {
        quantidadeAtual: estoqueAtual,
        estoqueMinimo,
        quantidadeSugerida: round2(data.quantidadeSugerida),
        origem: "MANUAL",
        observacao: data.observacao?.trim() || null,
      },
      include: {
        produto: { select: { nomeComercial: true } },
      },
    });

    return {
      message: "Produto adicionado à sugestão de compras",
      suggestion: {
        id: suggestion.id.toString(),
        produtoId: suggestion.produtoId.toString(),
        produtoNome: suggestion.produto.nomeComercial,
        quantidadeSugerida: round2(toNumber(suggestion.quantidadeSugerida)),
        origem: suggestion.origem,
      },
    };
  }
}
