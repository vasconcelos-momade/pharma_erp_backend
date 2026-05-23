import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";

export class GetCurrentCaixaSessaoUseCase {
  async execute(userId: string) {
    const prisma = getPrisma();

    const sessao = await prisma.caixaSessao.findFirst({
      where: {
        userId: BigInt(userId),
        status: "ABERTA",
        deletedAt: null,
      },
      include: {
        caixa: {
          include: {
            terminal: true,
          },
        },
      },
      orderBy: {
        openedAt: "desc",
      },
    });

    if (!sessao) {
      return null;
    }

    return {
      id: sessao.id.toString(),
      caixaId: sessao.caixaId.toString(),
      userId: sessao.userId.toString(),
      abertura: Number(sessao.abertura),
      sistema: Number(sessao.sistema),
      contado: sessao.contado == null ? null : Number(sessao.contado),
      diferenca: sessao.diferenca == null ? null : Number(sessao.diferenca),
      observacaoFecho: sessao.observacaoFecho,
      fechadoPorId: sessao.fechadoPorId?.toString() ?? null,
      status: sessao.status,
      openedAt: sessao.openedAt,
      closedAt: sessao.closedAt,
      deletedAt: sessao.deletedAt,
      terminal: {
        id: sessao.caixa.terminal.id.toString(),
        codigo: sessao.caixa.terminal.codigo,
        nome: sessao.caixa.terminal.nome,
        localizacao: sessao.caixa.terminal.localizacao,
      },
    };
  }
}
