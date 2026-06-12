import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { NotFoundApiError } from "../../../../../../shared/http/api-error";

export class ListProductLotsUseCase {
  async execute(produtoId: string) {
    const prisma = getPrisma() as any;

    const produto = await prisma.produto.findUnique({
      where: { id: BigInt(produtoId) },
      select: { id: true, nome: true },
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
        quantidadeAtual: true,
        estadoSanitario: true,
        disponibilidade: true,
      },
      orderBy: { dataValidade: "asc" },
    });

    return lotes.map((lote: any) => ({
      id: lote.id.toString(),
      numeroLote: lote.numeroLote,
      dataValidade: lote.dataValidade,
      quantidadeAtual: Number(lote.quantidadeAtual),
      quantidadeDisponivel: Number(lote.quantidadeAtual),
      estadoSanitario: lote.estadoSanitario,
      disponibilidade: lote.disponibilidade,
    }));
  }
}
