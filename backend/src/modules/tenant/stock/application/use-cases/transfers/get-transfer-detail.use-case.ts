import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { NotFoundApiError } from "../../../../../../shared/http/api-error";

export class GetTransferDetailUseCase {
  async execute(transferenciaId: string) {
    const prisma = getPrisma() as any;

    const transferencia = await prisma.transferencia.findUnique({
      where: { id: BigInt(transferenciaId) },
      include: {
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

    if (!transferencia) {
      throw new NotFoundApiError(
        `Transferência ${transferenciaId} não encontrada`,
      );
    }

    return {
      id: transferencia.id.toString(),
      numeroDocumento: transferencia.numeroDocumento,
      origem: transferencia.origem,
      destino: transferencia.destino,
      tipo: transferencia.tipo,
      status: transferencia.status,
      observacao: transferencia.observacao,
      confirmedAt: transferencia.confirmedAt,
      createdAt: transferencia.createdAt,
      updatedAt: transferencia.updatedAt,
      user: transferencia.user
        ? {
            id: transferencia.user.id.toString(),
            name: transferencia.user.name,
            email: transferencia.user.email,
          }
        : null,
      confirmedBy: transferencia.confirmedBy
        ? {
            id: transferencia.confirmedBy.id.toString(),
            name: transferencia.confirmedBy.name,
            email: transferencia.confirmedBy.email,
          }
        : null,
      itens: transferencia.itens.map((item: any) => ({
        id: item.id.toString(),
        quantidade: Number(item.quantidade),
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
