import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";

export interface LiquidarConvenioDTO {
  empresaId: string;
  userId: string;
  caixaId: string;
  valorPagamento: number;
  metodoPagamento: "TRANSFERENCIA" | "DINHEIRO" | "CARTAO";
  referencia?: string;
}

export class LiquidarConvenioUseCase {
  async execute(data: LiquidarConvenioDTO) {
    const prisma = getPrisma();

    return await prisma.$transaction(async (tx: any) => {
      // 1. Validar Empresa e Saldo com LOCK
      const empresas: any[] = await tx.$queryRaw`SELECT * FROM empresas WHERE id = ${BigInt(data.empresaId)} FOR UPDATE`;
      const empresaRaw = empresas[0];

      if (!empresaRaw) throw new Error("Empresa não encontrada");
      if (Number(empresaRaw.saldo_usado) <= 0) throw new Error("Esta empresa não possui saldo devedor para liquidação");

      // Buscar detalhes necessários (clientes e contas)
      const empresa = await tx.empresa.findUnique({
        where: { id: empresaRaw.id },
        include: { clientes: { include: { contasReceber: { where: { status: "ABERTA" } } } } }
      });

      const valorDisponivel = Math.min(data.valorPagamento, Number(empresaRaw.saldo_usado));
      let valorRestante = valorDisponivel;

      // 2. Abater dívidas dos clientes da empresa (FIFO)
      for (const cliente of empresa!.clientes) {
        if (valorRestante <= 0) break;

        for (const conta of cliente.contasReceber) {
          if (valorRestante <= 0) break;

          const valorAbater = Math.min(Number(conta.saldo), valorRestante);
          
          // Registrar Pagamento da Conta
          await tx.contaReceberPagamento.create({
            data: {
              contaReceberId: conta.id,
              userId: BigInt(data.userId),
              caixaId: BigInt(data.caixaId),
              valor: valorAbater,
              metodo: data.metodoPagamento
            }
          });

          // Atualizar Conta (Cache)
          const novoSaldo = Number(conta.saldo) - valorAbater;
          await tx.contaReceber.update({
            where: { id: conta.id },
            data: {
              saldo: novoSaldo,
              status: novoSaldo <= 0 ? "PAGA" : "PARCIAL"
            }
          });

          // Atualizar Saldo do Cliente (Cache)
          await tx.cliente.update({
            where: { id: cliente.id },
            data: { saldoAtual: { decrement: valorAbater } }
          });

          valorRestante -= valorAbater;
        }
      }

      // 3. Atualizar Saldo da Empresa (Cache)
      await tx.empresa.update({
        where: { id: empresa!.id },
        data: { saldoUsado: { decrement: valorDisponivel } }
      });

      // 4. Registrar no FINANCIAL LEDGER (Source of Truth Financeira)
      await tx.financialMovement.create({
        data: {
          userId: BigInt(data.userId),
          caixaId: BigInt(data.caixaId),
          type: "DEBT_PAYMENT",
          amount: valorDisponivel,
          reference: `LIQUIDACAO CONVENIO: ${empresa!.nome} - Ref: ${data.referencia || 'N/A'}`
        }
      });

      // 5. Registrar no Caixa (Visão Operacional)
      const caixas: any[] = await tx.$queryRaw`SELECT * FROM caixas WHERE id = ${BigInt(data.caixaId)} FOR UPDATE`;
      const caixa = caixas[0];

      if (!caixa) throw new Error("Caixa não encontrado");

      await tx.caixaMovimento.create({
        data: {
          caixaId: caixa.id,
          userId: BigInt(data.userId),
          tipo: "ENTRADA",
          origem: "PAGAMENTO",
          valor: valorDisponivel,
          saldoAnterior: caixa.saldo_atual,
          saldoFinal: Number(caixa.saldo_atual) + valorDisponivel,
          descricao: `Liquidação Convênio Empresa: ${empresa!.nome}`
        }
      });

      await tx.caixa.update({
        where: { id: caixa.id },
        data: { 
          saldoAtual: { increment: valorDisponivel },
          version: { increment: 1 }
        }
      });

      // 6. Business Event (EVENT SOURCING)
      await tx.businessEvent.create({
        data: {
          userId: BigInt(data.userId),
          type: "CONVENIO_LIQUIDATED",
          entity: "Empresa",
          entityId: empresa!.id,
          payload: {
            action: "LIQUIDATE_CONVENIO",
            empresa: empresa!.nome,
            valorPago: valorDisponivel,
            metodo: data.metodoPagamento,
            timestamp: new Date().toISOString()
          }
        }
      });

      return {
        success: true,
        valorLiquidado: valorDisponivel,
        saldoRestanteEmpresa: Number(empresa.saldoUsado) - valorDisponivel
      };
    });
  }
}
