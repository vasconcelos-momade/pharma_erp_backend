import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";

export interface ListRequisitionsInput {
  status?: "PENDENTE" | "APROVADA" | "REJEITADA" | "CONCLUIDA" | "CANCELADA";
  tipo?: "COMPRA" | "SAIDA" | "ENTRADA";
  origem?: string;
  destino?: string;
  fornecedorId?: string;
}

export class ListRequisitionsUseCase {
  async execute(filters: ListRequisitionsInput) {
    const prisma = getPrisma() as any;

    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.origem) where.origem = filters.origem.trim();
    if (filters.destino) where.destino = filters.destino.trim();
    if (filters.fornecedorId) {
      where.fornecedorId = BigInt(filters.fornecedorId);
    }

    const requisicoes = await prisma.requisicao.findMany({
      where,
      include: {
        fornecedor: { select: { id: true, nome: true } },
        itens: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return requisicoes.map((requisicao: any) => ({
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
      totalItens: requisicao.itens.length,
      quantidadeTotal: requisicao.itens.reduce(
        (sum: number, item: any) =>
          sum + Number(item.quantidadeSolicitada ?? 0),
        0,
      ),
      createdAt: requisicao.createdAt,
      updatedAt: requisicao.updatedAt,
    }));
  }
}

export type ListTransfersInput = ListRequisitionsInput;
export const ListTransfersUseCase = ListRequisitionsUseCase;
