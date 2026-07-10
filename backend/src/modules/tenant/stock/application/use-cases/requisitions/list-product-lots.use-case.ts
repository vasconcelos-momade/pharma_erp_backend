import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { NotFoundApiError } from "../../../../../../shared/http/api-error";

export class ListProductLotsUseCase {
  async execute(produtoId: string) {
    const prisma = getPrisma() as any;

    const produto = await prisma.produto.findUnique({
      where: { id: BigInt(produtoId) },
      select: { id: true, nomeComercial: true },
    });

    if (!produto) {
      throw new NotFoundApiError(`Produto ${produtoId} não encontrado`);
    }

    const lotes = await prisma.lote.findMany({
      where: {
        produtoId: produto.id,
        deletedAt: null,
        ativo: true,
      },
      select: {
        id: true,
        numeroLote: true,
        dataValidade: true,
        estadoSanitario: true,
        disponibilidade: true,
        stockBalance: {
          select: {
            quantidadeTotal: true,
            quantidadeDisponivel: true,
          },
        },
      },
      orderBy: { dataValidade: "asc" },
    });

    return lotes.map((lote: any) => ({
      id: lote.id.toString(),
      numeroLote: lote.numeroLote,
      dataValidade: lote.dataValidade,
      quantidadeTotal: Number(lote.stockBalance?.quantidadeTotal ?? 0),
      quantidadeDisponivel: Number(lote.stockBalance?.quantidadeDisponivel ?? lote.quantidadeAtual ?? 0),
      estadoSanitario: lote.estadoSanitario,
      disponibilidade: lote.disponibilidade,
    }));
  }
}
