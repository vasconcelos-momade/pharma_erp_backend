import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ComplianceAuditService } from "../../../../../shared/services/compliance-audit.service";
import { flattenProdutoForApi } from "../../../products/domain/produto-presenter";
import {
  applyStockReturnDelta,
  getQuantidadeTotal,
} from "../../../stock/domain/produto-stock.service";

export interface AnularFaturaDTO {
  faturaId: string;
  userId: string;
  motivo: string;
  observacoes?: string;
}

export class AnularFaturaUseCase {
  async execute(data: AnularFaturaDTO) {
    const prisma = getPrisma();

    return await prisma.$transaction(async (tx: any) => {
      // 1. Buscar Fatura com LOCK (Pessimistic Locking)
      const faturas: any[] = await tx.$queryRaw`SELECT * FROM faturas WHERE id = ${BigInt(data.faturaId)} FOR UPDATE`;
      const fatura = faturas[0];

      if (!fatura) throw new Error("Fatura não encontrada");
      if (fatura.estado === "ANULADA") throw new Error("Esta fatura já foi anulada");

      // Buscar itens e detalhes
      const items = await tx.faturaItem.findMany({
        where: { faturaId: fatura.id },
        include: { produto: { include: { regulacao: true } }, lote: true },
      });

      const pagamentos = await tx.pagamento.findMany({
        where: { faturaId: fatura.id }
      });

      // 2. Validar Permissões do Usuário com LOCK
      const users: any[] = await tx.$queryRaw`SELECT * FROM users WHERE id = ${BigInt(data.userId)} FOR UPDATE`;
      const userAnulando = users[0];

      if (!userAnulando) throw new Error("Usuário não encontrado");
      
      const permissoesPermitidas = ["ADMIN", "GERENTE", "DIRETOR_TECNICO"];
      if (!permissoesPermitidas.includes(userAnulando.role)) {
        throw new Error("Você não tem permissão para anular faturas. Apenas Administradores ou Gerentes podem realizar esta ação.");
      }

      // 3. Atualizar Estado da Fatura (Cache)
      await tx.fatura.update({
        where: { id: fatura.id },
        data: { 
          estado: "ANULADA",
          cancelledAt: new Date(),
          cancelledById: BigInt(data.userId),
          version: { increment: 1 }
        }
      });

      // 4. Criar Registro de Anulação
      await tx.faturaAnulacao.create({
        data: {
          faturaId: fatura.id,
          userId: BigInt(data.userId),
          motivo: data.motivo,
          observacoes: data.observacoes
        }
      });

      // 5. Reverter Estoque e Dispensações (STOCK LEDGER)
      for (const item of items) {
        if (item.produtoId && item.produto) {
          // Bloqueio do Produto e Lote
          await tx.$queryRaw`SELECT id FROM produtos WHERE id = ${item.produtoId} FOR UPDATE`;
          if (item.loteId) {
            await tx.$queryRaw`SELECT id FROM lotes WHERE id = ${item.loteId} FOR UPDATE`;
          }

          const qty = Number(item.quantidade);
          const estoqueAnterior = await getQuantidadeTotal(tx, item.produtoId);
          const estoqueFinal = await applyStockReturnDelta(tx, item.produtoId, qty);

          await tx.produto.update({
            where: { id: item.produtoId },
            data: { version: { increment: 1 } },
          });

          // 2. Reverter Quantidade no Lote (Cache)
          if (item.loteId) {
            await tx.lote.update({
              where: { id: item.loteId },
              data: { 
                quantidadeAtual: { increment: item.quantidade },
                version: { increment: 1 }
              }
            });
          }

          // 3. Registrar StockReversal
          await tx.stockReversal.create({
            data: {
              faturaId: fatura.id,
              produtoId: item.produtoId,
              loteId: item.loteId,
              userId: BigInt(data.userId),
              quantidade: item.quantidade,
              motivo: data.motivo
            }
          });

          // 4. Criar Movimento de DEVOLUÇÃO (SOURCE OF TRUTH)
          await tx.estoqueMovimento.create({
            data: {
              produtoId: item.produtoId,
              loteId: item.loteId,
              userId: BigInt(data.userId),
              tipo: "ENTRADA",
              quantidade: item.quantidade,
              estoqueAnterior,
              estoqueFinal,
              origem: "ANULACAO_FATURA",
              observacoes: `Estorno da Fatura #${fatura.numero}`
            }
          });

          const produtoFlat = flattenProdutoForApi(
            item.produto as Record<string, unknown>,
          );

          if (produtoFlat.requiresPsychotropicBook) {
            await tx.livroPsicotropico.create({
              data: {
                produtoId: item.produtoId,
                loteId: item.loteId,
                responsavelId: BigInt(data.userId),
                tipoMovimento: "ENTRADA",
                quantidade: item.quantidade,
                saldoAnterior: estoqueAnterior,
                saldoAtual: estoqueFinal,
                numeroDocumento: fatura.numero,
                observacoes: `ESTORNO (Anulação da Fatura #${fatura.numero})`
              }
            });
          }
        }
      }

      // 6. Reverter Financeiro (FINANCIAL LEDGER)
      for (const pagamento of pagamentos) {
        if (pagamento.status === "CONFIRMADO") {
          // Marcar pagamento como estornado
          await tx.pagamento.update({
            where: { id: pagamento.id },
            data: { 
              status: "ESTORNADO",
              deletedAt: new Date()
            }
          });

          // Registrar no FINANCIAL LEDGER (Source of Truth Financeira)
          await tx.financialMovement.create({
            data: {
              userId: BigInt(data.userId),
              caixaId: pagamento.caixaId,
              faturaId: fatura.id,
              type: "REFUND",
              amount: pagamento.valor,
              reference: `ESTORNO Fatura #${fatura.numero}: ${data.motivo}`
            }
          });

          // Registrar Reembolso Formal (Refund)
          await tx.paymentRefund.create({
            data: {
              paymentId: pagamento.id,
              userId: BigInt(data.userId),
              valor: pagamento.valor,
              metodo: pagamento.metodo,
              motivo: data.motivo
            }
          });

          // Se vinculado a um caixa, realizar o estorno no saldo
          if (pagamento.caixaId) {
            const caixas: any[] = await tx.$queryRaw`SELECT * FROM caixas WHERE id = ${pagamento.caixaId} FOR UPDATE`;
            const caixa = caixas[0];

            if (caixa) {
              const saldoCaixaAnterior = Number(caixa.saldoAtual ?? caixa.saldo_atual ?? 0);
              const valorEstorno = Number(pagamento.valor);
              const saldoCaixaFinal = saldoCaixaAnterior - valorEstorno;

              await tx.caixaMovimento.create({
                data: {
                  caixaId: caixa.id,
                  userId: BigInt(data.userId),
                  faturaId: fatura.id,
                  tipo: "SAIDA",
                  origem: "OUTRO",
                  valor: pagamento.valor,
                  saldoAnterior: saldoCaixaAnterior,
                  saldoFinal: saldoCaixaFinal,
                  descricao: `ESTORNO (Anulação da Fatura #${fatura.numero})`
                }
              });

              await tx.caixa.update({
                where: { id: caixa.id },
                data: { 
                  saldoAtual: { decrement: pagamento.valor },
                  version: { increment: 1 }
                }
              });
            }
          }
        }
      }

      // 7. Audit Log imutável
      const complianceService = new ComplianceAuditService();
      await complianceService.createImmutableLog({
        userId: data.userId,
        action: "ANULAR_FATURA",
        entity: "Fatura",
        entityId: fatura.id,
        before: { estado: fatura.estado },
        after: { estado: "ANULADA", motivo: data.motivo }
      }, tx);

      // 8. Registrar Business Event (EVENT SOURCING)
      await tx.businessEvent.create({
        data: {
          userId: BigInt(data.userId),
          type: "SALE_CANCELED",
          entity: "Fatura",
          entityId: fatura.id,
          payload: {
            action: "CANCEL",
            faturaId: fatura.id.toString(),
            numero: fatura.numero,
            totalEstornado: fatura.total.toString(),
            motivo: data.motivo,
            itensCancelados: items.length,
            timestamp: new Date().toISOString()
          }
        }
      });

      return {
        success: true,
        message: "Fatura anulada com sucesso e todos os movimentos foram estornados.",
        faturaId: fatura.id.toString(),
        numero: fatura.numero
      };
    });
  }
}
