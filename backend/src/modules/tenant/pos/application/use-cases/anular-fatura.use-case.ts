import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ComplianceAuditService } from "../../../../../shared/services/compliance-audit.service";
import { PermissionService } from "../../../shared/permission.service";
import { flattenProdutoForApi } from "../../../products/domain/produto-presenter";
import {
  getQuantidadeTotalFromMovements,
  syncStockBalanceCache,
} from "../../../stock/domain/produto-stock.service";
import { restoreStockFromAllocations } from "../../../stock/domain/fefo-allocation.service";

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
        include: {
          produto: { include: { regulacao: true } },
          lotesAlocacao: {
            include: { lote: { select: { id: true, quantidadeQuarentena: true } } },
            orderBy: { ordemFefo: "asc" },
          },
        },
      });

      const pagamentos = await tx.pagamento.findMany({
        where: { faturaId: fatura.id }
      });

      // 2. Validar permissao explicitamente pela matriz de autorizacao.
      const permissionService = new PermissionService(tx as any);
      await permissionService.assertPermission(
        data.userId,
        "POS",
        "CANCEL",
        "Voce nao tem permissao para anular faturas.",
      );

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
          await tx.$queryRaw`SELECT id FROM produtos WHERE id = ${item.produtoId} FOR UPDATE`;

          const allocations = (item.lotesAlocacao ?? []).map((a: any) => ({
            loteId: a.loteId,
            quantidade: Number(a.quantidade),
            quantidadeQuarentena: a.lote?.quantidadeQuarentena,
          }));

          if (allocations.length === 0) {
            continue;
          }

          for (const alloc of allocations) {
            await tx.$queryRaw`SELECT id FROM lotes WHERE id = ${alloc.loteId} FOR UPDATE`;
          }

          const estoqueAnterior = await getQuantidadeTotalFromMovements(
            tx,
            item.produtoId,
          );

          const estoqueFinal = await restoreStockFromAllocations(tx, {
            produtoId: item.produtoId,
            userId: BigInt(data.userId),
            allocations,
            origem: "ANULACAO_FATURA",
            observacoes: `Estorno da Fatura #${fatura.numero}`,
            idempotencyKeyPrefix: `REV-FAT-${fatura.id}-ITEM-${item.id}`,
          });

          await tx.produto.update({
            where: { id: item.produtoId },
            data: { version: { increment: 1 } },
          });

          await tx.stockReversal.create({
            data: {
              faturaId: fatura.id,
              faturaItemId: item.id,
              produtoId: item.produtoId,
              loteId: allocations[0]?.loteId,
              userId: BigInt(data.userId),
              quantidade: item.quantidade,
              motivo: data.motivo,
            },
          });

          // Movimentos já criados por restoreStockFromAllocations

          const produtoFlat = flattenProdutoForApi(
            item.produto as Record<string, unknown>,
          );

          if (produtoFlat.requiresPsychotropicBook) {
            const dispensacao = await tx.dispensacao.findFirst({
              where: { faturaItemId: item.id },
              select: { id: true },
            });

            await tx.livroPsicotropico.create({
              data: {
                dispensacaoId: dispensacao?.id,
                responsavelId: BigInt(data.userId),
                tipoMovimento: "ENTRADA",
                numeroDocumento: fatura.numero,
                idempotencyKey: `LP-REV-${fatura.id}-${item.id}`,
                observacoes: `ESTORNO (Anulação da Fatura #${fatura.numero})`,
              },
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
