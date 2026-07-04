import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { NotFoundApiError } from "../../../../../../shared/http/api-error";
import { mapLoteListItem } from "./lote.mapper";

export class GetLoteDetailUseCase {
  async execute(loteId: string) {
    const prisma = getPrisma() as any;
    const lote = await prisma.lote.findFirst({
      where: { id: BigInt(loteId), deletedAt: null },
      include: {
        produto: {
          select: {
            id: true,
            nomeComercial: true,
            barcode: true,
            categoria: { select: { id: true, nome: true } },
          },
        },
        fornecedor: { select: { id: true, nome: true, nuit: true } },
        stockBalance: true,
      },
    });

    if (!lote) {
      throw new NotFoundApiError(`Lote ${loteId} não encontrado`);
    }

    return {
      ...mapLoteListItem(lote),
      dataFabricacao: lote.dataFabricacao?.toISOString() ?? null,
      quantidadeInicial: Number(lote.quantidadeInicial),
      quantidadeQuarentena: Number(lote.quantidadeQuarentena ?? 0),
      quantidadeIncinerada: Number(lote.quantidadeIncinerada ?? 0),
      produto: lote.produto
        ? {
            id: lote.produto.id.toString(),
            nome: lote.produto.nomeComercial,
            barcode: lote.produto.barcode ?? null,
            categoria: lote.produto.categoria
              ? {
                  id: lote.produto.categoria.id.toString(),
                  nome: lote.produto.categoria.nome,
                }
              : null,
          }
        : null,
      fornecedor: lote.fornecedor
        ? {
            id: lote.fornecedor.id.toString(),
            nome: lote.fornecedor.nome,
            nuit: lote.fornecedor.nuit ?? null,
          }
        : null,
    };
  }
}
