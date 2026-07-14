import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";

export class GetCashflowContextUseCase {
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
            cashBalance: true,
          },
        },
      },
      orderBy: {
        openedAt: "desc",
      },
    });

    if (!sessao) {
      throw new Error(
        "Não existe sessão de caixa aberta. Abra o caixa no POS antes de registar movimentos.",
      );
    }

    const saldoAtual = Number(sessao.caixa.saldoAtual ?? 0);
    const saldoTotal = Number(sessao.caixa.cashBalance?.saldoTotal ?? saldoAtual);

    return {
      sessaoId: sessao.id.toString(),
      caixaId: sessao.caixaId.toString(),
      saldoAtual,
      saldoTotal,
      terminal: {
        id: sessao.caixa.terminal.id.toString(),
        codigo: sessao.caixa.terminal.codigo,
        nome: sessao.caixa.terminal.nome,
        localizacao: sessao.caixa.terminal.localizacao,
      },
      origens: [
        { value: "PAGAMENTO", label: "Pagamento" },
        { value: "PEDIDO", label: "Pedido" },
        { value: "COMPRA", label: "Compra" },
        { value: "SANGRIA", label: "Sangria" },
        { value: "REFORCO", label: "Reforço" },
        { value: "OUTRO", label: "Outros" },
      ],
    };
  }
}
