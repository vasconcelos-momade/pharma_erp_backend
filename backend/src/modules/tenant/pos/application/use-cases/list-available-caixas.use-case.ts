import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";

export class ListAvailableCaixasUseCase {
  async execute() {
    const prisma = getPrisma();

    const caixas = await prisma.caixa.findMany({
      where: {
        deletedAt: null,
        terminal: {
          ativo: true,
          deletedAt: null,
        },
      },
      include: {
        terminal: true,
        sessoes: {
          where: {
            status: "ABERTA",
            deletedAt: null,
          },
          take: 1,
        },
      },
      orderBy: {
        terminal: {
          codigo: "asc",
        },
      },
    });

    return caixas
      .filter((caixa) => caixa.sessoes.length === 0)
      .map((caixa) => ({
        caixaId: caixa.id.toString(),
        terminalId: caixa.terminal.id.toString(),
        terminalCodigo: caixa.terminal.codigo,
        terminalNome: caixa.terminal.nome,
        localizacao: caixa.terminal.localizacao,
      }));
  }
}
