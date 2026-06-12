import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { NotFoundApiError } from "../../../../../../shared/http/api-error";

export class GetRequisitionDetailUseCase {
  async execute(requisicaoId: string) {
    const prisma = getPrisma() as any;

    const requisicao = await prisma.requisicao.findUnique({
      where: { id: BigInt(requisicaoId) },
      include: {
        fornecedor: {
          select: { id: true, nome: true },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        confirmedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        itens: {
          include: {
            produto: {
              select: {
                id: true,
                nome: true,
              },
            },
            lote: {
              select: {
                id: true,
                numeroLote: true,
                dataValidade: true,
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!requisicao) {
      throw new NotFoundApiError(`Requisicao ${requisicaoId} nao encontrada`);
    }

    return {
      id: requisicao.id.toString(),
      requisicaoId: requisicao.id.toString(),
      numeroDocumento: requisicao.numeroDocumento,
      origem: requisicao.origem,
      destino: requisicao.destino,
      tipo: requisicao.tipo,
      status: requisicao.status,
      observacao: requisicao.observacao,
      fornecedorId: requisicao.fornecedorId?.toString() ?? null,
      fornecedorNome: requisicao.fornecedor?.nome ?? null,
      total: requisicao.total != null ? Number(requisicao.total) : null,
      approvedAt: requisicao.confirmedAt,
      confirmedAt: requisicao.confirmedAt,
      createdAt: requisicao.createdAt,
      updatedAt: requisicao.updatedAt,
      user: requisicao.user
        ? {
            id: requisicao.user.id.toString(),
            name: requisicao.user.name,
            email: requisicao.user.email,
          }
        : null,
      confirmedBy: requisicao.confirmedBy
        ? {
            id: requisicao.confirmedBy.id.toString(),
            name: requisicao.confirmedBy.name,
            email: requisicao.confirmedBy.email,
          }
        : null,
      itens: requisicao.itens.map((item: any) => ({
        id: item.id.toString(),
        quantidadeSolicitada: Number(item.quantidadeSolicitada ?? 0),
        numeroLote: item.numeroLote,
        dataValidade: item.dataValidade,
        precoCompra:
          item.precoCompra != null ? Number(item.precoCompra) : null,
        precoVenda: item.precoVenda != null ? Number(item.precoVenda) : null,
        subtotal: item.subtotal != null ? Number(item.subtotal) : null,
        produto: item.produto
          ? {
              id: item.produto.id.toString(),
              nome: item.produto.nome,
            }
          : null,
        lote: item.lote
          ? {
              id: item.lote.id.toString(),
              numeroLote: item.lote.numeroLote,
              dataValidade: item.lote.dataValidade,
            }
          : null,
      })),
    };
  }
}
