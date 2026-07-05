import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { flattenProdutoForApi, produtoWithRegulacaoInclude } from "../../../products/domain/produto-presenter";
import { getQuantidadeDisponivel } from "../../../stock/domain/produto-stock.service";

export interface ValidarDispensacaoDTO {
  produtoId: string;
  quantidade: number;
}

function formatarQuantidadeUnidades(quantidade: number) {
  const unidadeLabel = quantidade === 1 ? "unidade" : "unidades";
  return `${quantidade} ${unidadeLabel}`;
}

export class ValidarDispensacaoUseCase {
  async execute(data: ValidarDispensacaoDTO) {
    const prisma = getPrisma();

    const produtoRow = await prisma.produto.findUnique({
      where: { id: BigInt(data.produtoId) },
      include: produtoWithRegulacaoInclude,
    });

    if (!produtoRow) throw new Error("Produto não encontrado");

    const produto = flattenProdutoForApi(produtoRow as Record<string, unknown>);
    const quantidadeDisponivel = await getQuantidadeDisponivel(prisma, produtoRow.id);
    const estoqueDisponivel = quantidadeDisponivel >= data.quantidade;
    const stockZero = quantidadeDisponivel <= 0;

    const response = {
      permitido: !stockZero && estoqueDisponivel,
      necessitaReceita: false,
      necessitaLote: false,
      necessitaValidacao: false,
      tipoDispensacao: produto.tipoDispensacao,
      estoqueDisponivel,
      quantidadeDisponivel,
      mensagem: stockZero
        ? "Não é possível adicionar este produto. Stock indisponível."
        : estoqueDisponivel
          ? "Produto com stock disponível."
          : `Stock insuficiente. Disponível: ${formatarQuantidadeUnidades(quantidadeDisponivel)}.`,
    };

    switch (produto.tipoDispensacao) {
      case "RECEITA_NORMAL":
        response.necessitaReceita = true;
        break;
      case "RECEITA_ESPECIAL":
        response.necessitaReceita = true;
        response.necessitaValidacao = true;
        response.necessitaLote = true;
        break;
    }

    return response;
  }
}
