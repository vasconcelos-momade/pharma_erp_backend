import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ComplianceAuditService } from "../../../../../shared/services/compliance-audit.service";
import { ComplianceEngineService } from "../../../../../shared/services/compliance-engine.service";
import { FiscalCalculatorUtil } from "../../../../../shared/utils/fiscal-calculator.util";
import type { TaxRuleSnapshot } from "../../../../../shared/utils/fiscal-calculator.util";
import { serializeForJson } from "../../../../../shared/http/serialize-json";
import { draftCartService } from "../services/draft-cart.service";
import { flattenProdutoForApi, resolveRegulacaoPolicyForProduto } from "../../../products/domain/produto-presenter";
import { requiresLivroReceita } from "../../../products/domain/produto-dispensacao-policy";
import {
  getQuantidadeTotalFromMovements,
  syncStockBalanceCache,
} from "../../../stock/domain/produto-stock.service";
import { consumeStockFefo } from "../../../stock/domain/fefo-allocation.service";
import { getSellableQuantityFromLoteMovements } from "../../../stock/domain/lote-stock.service";
import { resolveLotePrecoVenda } from "../../../stock/domain/fefo-lote.service";
import { replaceItemLoteAllocations } from "../../../sales/domain/fatura-item-lote.service";

export interface FinalizarVendaDTO {
  clienteId?: string;
  terminalId: string;
  userId: string;
  idempotencyKey?: string;
  validatorUserId?: string;
  metodoPagamento: "DINHEIRO" | "CARTAO" | "TRANSFERENCIA" | "CARTEIRA_MOVEL" | "EMOLA" | "MPESA";
  valorRecebido?: number;
  paciente?: {
    nome?: string | null;
    idade?: number | null;
    nid?: string | null;
  };
  receita?: {
    numero?: string | null;
    medicoNome?: string | null;
    prescritor?: string | null;
    unidadeSanitaria?: string | null;
  };
  items?: {
    tipo: "produto" | "servico";
    produtoId?: string;
    servicoId?: string;
    quantidade: number;
    precoUnit?: number;
    receita?: {
      numero?: string;
      medicoNome?: string;
    };
  }[];
}

export class FinalizarVendaUseCase {
  private static readonly MAX_PATIENT_AGE = 130;

  async execute(data: FinalizarVendaDTO) {
    const prisma = getPrisma();

    try {
      // Padronização do isolamento transacional para nível SERIALIZABLE em operações de balcão
      // para evitar PHANTOM READS em picos de concorrência.
      return await prisma.$transaction(async (tx: any) => {
        // 0. Garantir chave de carrinho activa e verificar idempotência de retry
        if (data.idempotencyKey) {
          const activeCartKey = await draftCartService.ensureActiveCartKey(tx, {
            userId: data.userId,
            idempotencyKey: data.idempotencyKey,
            terminalId: data.terminalId,
          });
          data.idempotencyKey = activeCartKey;

          const nextCartIdempotencyKey = await draftCartService.buildFreshCartKey(
            tx,
            data.userId,
          );
          const scopedKey = `TERM-${data.terminalId}:${data.idempotencyKey}`;
          const existingFatura = await tx.fatura.findFirst({
            where: {
              terminalId: BigInt(data.terminalId),
              idempotencyKey: scopedKey,
            },
            select: {
              id: true,
              numero: true,
              subtotal: true,
              ivaTotal: true,
              total: true,
              valorRecebido: true,
              troco: true,
              estado: true,
            },
          });

          if (existingFatura) {
            const draftFatura = await tx.fatura.findFirst({
              where: {
                idempotencyKey: data.idempotencyKey,
                estado: "RASCUNHO",
                userId: BigInt(data.userId),
              },
              select: { _count: { select: { items: true } } },
            });

            const hasPendingDraftItems = (draftFatura?._count?.items ?? 0) > 0;
            if (!hasPendingDraftItems) {
              await this.cleanupCheckoutDraftArtifacts(
                tx,
                existingFatura.id,
                data.idempotencyKey,
              );

              return {
                success: true,
                faturaId: existingFatura.id.toString(),
                numero: existingFatura.numero,
                estado: existingFatura.estado,
                subtotal: Number(existingFatura.subtotal),
                ivaTotal: Number(existingFatura.ivaTotal),
                total: Number(existingFatura.total),
                valorRecebido:
                  existingFatura.valorRecebido == null
                    ? null
                    : Number(existingFatura.valorRecebido),
                troco: Number(existingFatura.troco ?? 0),
                items: [],
                isDuplicate: true,
                cartReset: true,
                nextCartIdempotencyKey,
              };
            }
          }
        }

        const checkoutItems =
          data.items && data.items.length > 0
            ? data.items
            : data.idempotencyKey
              ? await draftCartService.resolveCheckoutItemsFromDraft(
                  tx,
                  data.idempotencyKey,
                  data.userId,
                )
              : [];

        if (checkoutItems.length === 0) {
          throw new Error(
            "Informe idempotencyKey do carrinho ou a lista de items para finalizar.",
          );
        }

        const checkoutData: FinalizarVendaDTO = {
          ...data,
          items: checkoutItems,
        };

        // 1. Validar Terminal e Caixa com LOCK (Pessimistic Locking)
        const terminals: any[] = await tx.$queryRaw`SELECT * FROM terminais WHERE id = ${BigInt(data.terminalId)} FOR UPDATE`;
        const terminal = terminals[0];
        if (!terminal) throw new Error("Terminal não encontrado");

        const caixas: any[] = await tx.$queryRaw`SELECT * FROM caixas WHERE terminalId = ${terminal.id} FOR UPDATE`;
        const caixa = caixas[0];
        if (!caixa) throw new Error("Nenhum caixa aberto para este terminal");

        // 1.1 Validar Sessão de Caixa Ativa com LOCK
        const sessoes: any[] = await tx.$queryRaw`SELECT * FROM caixa_sessoes WHERE caixaId = ${caixa.id} AND userId = ${BigInt(data.userId)} AND status = 'ABERTA' FOR UPDATE`;
        const sessaoAtiva = sessoes[0];

        if (!sessaoAtiva) {
          throw new Error("Você não possui uma sessão de caixa aberta. Por favor, abra o caixa antes de vender.");
        }

        const produtosDoCarrinho = checkoutItems
          .filter(
            (item: NonNullable<FinalizarVendaDTO["items"]>[number]) =>
              item.tipo === "produto" && item.produtoId,
          )
          .map((item: NonNullable<FinalizarVendaDTO["items"]>[number]) =>
            BigInt(item.produtoId!),
          );

        const produtosComReceitaObrigatoria = produtosDoCarrinho.length
          ? (
              await tx.produto.findMany({
                where: { id: { in: produtosDoCarrinho } },
                select: {
                  id: true,
                  nomeComercial: true,
                  regulacao: {
                    select: {
                      tipoDispensacao: true,
                      requiresPrescription: true,
                    },
                  },
                  categoria: {
                    select: { id: true, nome: true, codigoFNM: true },
                  },
                },
              })
            ).filter(
              (produto: {
                regulacao?: {
                  requiresPrescription?: boolean;
                  tipoDispensacao?: string;
                } | null;
                categoria?: { id?: bigint; nome?: string; codigoFNM?: string | null } | null;
              }) =>
                produto.regulacao?.requiresPrescription === true ||
                resolveRegulacaoPolicyForProduto(produto as any).requiresPrescription,
            )
          : [];

        const requerPacienteReceita = produtosComReceitaObrigatoria.length > 0;
        // Cliente seleccionado ou padrão "Consumidor Final" — nunca null em Fatura.
        const clienteId = await draftCartService.resolveClienteId(
          tx,
          checkoutData.clienteId,
        );
        const clienteVenda = await tx.cliente.findFirst({
          where: { id: clienteId },
          select: { nome: true },
        });
        const nomeClienteVenda = clienteVenda?.nome?.trim() || "Consumidor Final";

        let totalGeral = 0;
        const faturaItems = [];
        const faturaNumero = `FR-${Date.now()}`;

        // --- GESTÃO DE RECEITA (apenas para medicamentos sujeitos a receita) ---
        const receitaVenda = this.resolveReceitaPayload(checkoutData);
        let receitaFisicaId: bigint | null = null;
        let receitaMetadata: any = null;

        if (requerPacienteReceita) {
          const paciente = this.resolvePrescriptionPatientPayload(
            checkoutData,
            nomeClienteVenda,
          );
          const observacoesReceita = [
            `Receita física apresentada no POS. Fatura: #${faturaNumero}`,
            `Paciente: ${paciente.nome}`,
            ...(paciente.idade != null ? [`Idade: ${paciente.idade}`] : []),
            ...(paciente.nid ? [`NID: ${paciente.nid}`] : []),
          ].join(" | ");
          const receitaFisica = await tx.receita.create({
            data: {
              clienteId,
              medicoNome: receitaVenda?.medicoNome ?? null,
              numeroReceita: receitaVenda?.numero ?? null,
              unidadeSanitaria: receitaVenda?.unidadeSanitaria ?? null,
              dataReceita: new Date(),
              observacoes: observacoesReceita,
            },
          });
          receitaFisicaId = receitaFisica.id;
          receitaMetadata = {
            medicoNome: receitaFisica.medicoNome,
            numeroReceita: receitaFisica.numeroReceita,
            unidadeSanitaria: receitaFisica.unidadeSanitaria,
            dataReceita: receitaFisica.dataReceita,
          };
        }

        // 2. Processar Itens
        const complianceEngine = new ComplianceEngineService();

        const faturaItemsFiscais: any[] = [];
        for (const item of checkoutItems) {
          if (item.tipo === "produto") {
            const produtoId = BigInt(item.produtoId!);
            await tx.$executeRaw`SELECT id FROM produtos WHERE id = ${produtoId} FOR UPDATE`;
            const produtoRow = await tx.produto.findUnique({
              where: { id: produtoId },
              include: { regulacao: true, taxRule: true },
            });
            if (!produtoRow) throw new Error(`Produto ${item.produtoId} não encontrado`);
            const produto = flattenProdutoForApi(produtoRow as Record<string, unknown>);

            const complianceResult = await complianceEngine.validateVenda({
              produto,
              quantidade: item.quantidade,
              receitaId: receitaFisicaId,
              validatorUserId: data.validatorUserId,
            });

            if (!complianceResult.passed) {
              throw new Error(complianceResult.message);
            }

            const taxRule = produtoRow.taxRuleId
              ? await tx.taxRule.findUnique({ where: { id: produtoRow.taxRuleId } })
              : null;
            const taxRuleSnapshot: TaxRuleSnapshot | null = taxRule
              ? {
                  tipo: taxRule.tipo as any,
                  taxa: Number(taxRule.taxa),
                  codigo: taxRule.codigo,
                  descricao: taxRule.descricao,
                }
              : null;

            const disponivelAntes = await getSellableQuantityFromLoteMovements(
              tx,
              produtoId,
            );
            if (disponivelAntes < item.quantidade) {
              throw new Error(`Stock insuficiente para o produto ${produto.nomeComercial}`);
            }

            await tx.$executeRaw`SELECT id FROM lotes WHERE produtoId = ${produto.id} AND deletedAt IS NULL FOR UPDATE`;

            const precoFinal =
              item.precoUnit ??
              resolveLotePrecoVenda(
                (
                  await tx.lote.findFirst({
                    where: {
                      produtoId: produto.id,
                      ativo: true,
                      estadoSanitario: "VALIDO",
                      disponibilidade: "DISPONIVEL",
                      dataValidade: { gt: new Date() },
                    },
                    orderBy: { dataValidade: "asc" },
                    select: { precoVenda: true, numeroLote: true },
                  })
                ) ?? { precoVenda: 0, numeroLote: "" },
                String(produto.nomeComercial ?? ""),
              );

            // Cálculo fiscal usando utilitário
            const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
              quantidade: item.quantidade,
              precoUnitario: precoFinal,
              taxRule: taxRuleSnapshot,
              descricao: String(produto.nomeComercial ?? ""),
            });

            totalGeral += fiscalCalc.baseCalculo;

            const { allocations, totalCusto } = await consumeStockFefo(tx, {
              produtoId: produto.id as bigint,
              userId: BigInt(data.userId),
              quantidade: item.quantidade,
              origem: "POS_VENDA",
              observacoes: `Venda no Terminal ${terminal.nome}`,
              idempotencyKeyPrefix: `EM-FAT-${faturaNumero}`,
            });

            const lotesUtilizados = allocations.map((a) => ({
              loteId: a.lote.id,
              quantidade: a.quantidade,
            }));

            const stockSnapshotDepois = await syncStockBalanceCache(tx, produtoId);
            this.logStockCheckpoint("POS_CHECKOUT_STOCK_SYNC", {
              faturaNumero,
              produtoId: produtoId.toString(),
              produtoNomeComercial: produto.nomeComercial,
              quantidadeVendida: item.quantidade,
              disponivelAntes,
              disponivelDepois: stockSnapshotDepois.disponivel,
              estoqueTotalDepois: stockSnapshotDepois.total,
              lotesUtilizados: lotesUtilizados.map((entry) => ({
                loteId: entry.loteId.toString(),
                quantidade: entry.quantidade,
              })),
            });

            const custoUnitarioFinal = totalCusto / item.quantidade;
            const lucroUnitario = precoFinal - custoUnitarioFinal;

            // 2.3 Preparar dados para Dispensação apenas se não for Venda Livre
            let dispensacaoInfo = null;
            if (produto.tipoDispensacao !== "VENDA_LIVRE") {
              dispensacaoInfo = {
                produtoId: produto.id,
                loteId: lotesUtilizados[0]?.loteId,
                quantidade: item.quantidade,
                tipoDispensacao: produto.tipoDispensacao as any,
                isControlado: Boolean(produto.requiresPrescription),
                isPsicotropico: Boolean(produto.requiresPsychotropicBook),
                necessitaReceita: Boolean(produto.requiresPrescription),
                receitaVerificada: !!receitaFisicaId,
                receitaFisicaPresente: !!receitaFisicaId,
                receitaValida: !!receitaFisicaId,
                receitaId: receitaFisicaId,
                validacaoDupla: Boolean(produto.requiresDoubleCheck),
                validadoPorId: Boolean(produto.requiresDoubleCheck) && data.validatorUserId ? BigInt(data.validatorUserId) : null,
                motivoSaida: `Venda POS Terminal ${terminal.nome}`,
                receitaMetadata: receitaMetadata ? {
                  ...receitaMetadata,
                  saldoAnterior: disponivelAntes,
                  saldoAtual: stockSnapshotDepois.disponivel,
                } : null,
              };
            }

            // Item com todos os campos fiscais de snapshot
            const descricaoItem = [produto.nomeComercial, produto.dosagem, produto.forma]
              .map((part) => String(part ?? "").trim())
              .filter((part) => part.length > 0)
              .join(" ") || String(produto.nomeComercial ?? "");

            faturaItems.push({
              produtoId: produto.id,
              lotesUtilizados,
              descricao: descricaoItem,
              quantidade: item.quantidade,
              precoUnit: precoFinal,
              custoUnitario: custoUnitarioFinal,
              lucroUnitario: lucroUnitario,
              baseCalculo: fiscalCalc.baseCalculo,
              iva: fiscalCalc.taxaAplicadaPercentual,
              valorIva: fiscalCalc.valorIva,
              taxaAplicada: fiscalCalc.taxaAplicadaPercentual,
              tipoRegraFiscalSnapshot: fiscalCalc.tipoRegraFiscal as any,
              codigoRegraFiscal: fiscalCalc.codigoRegraFiscal,
              moedaTaxa: fiscalCalc.moedaTaxa,
              motivoIsencao: fiscalCalc.motivoIsencao,
              total: fiscalCalc.totalItem,
              dispensacaoInfo // Anexamos aqui para usar depois
            });
            faturaItemsFiscais.push(fiscalCalc);

          } else if (item.tipo === "servico") {
            const servico = await tx.servico.findUnique({
              where: { id: BigInt(item.servicoId!) },
              include: { taxRule: true }
            });

            if (!servico) throw new Error(`Serviço ${item.servicoId} não encontrado`);

            // Carregar regra fiscal do serviço
            const taxRule = servico.taxRule;
            const taxRuleSnapshot: TaxRuleSnapshot | null = taxRule
              ? {
                  tipo: taxRule.tipo as any,
                  taxa: Number(taxRule.taxa),
                  codigo: taxRule.codigo,
                  descricao: taxRule.descricao,
                }
              : null;

            const precoFinal = item.precoUnit || Number(servico.preco);

            // Cálculo fiscal usando utilitário
            const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
              quantidade: item.quantidade,
              precoUnitario: precoFinal,
              taxRule: taxRuleSnapshot,
              descricao: servico.nome,
            });

            totalGeral += fiscalCalc.baseCalculo;

            // Item com todos os campos fiscais de snapshot
            faturaItems.push({
              servicoId: servico.id,
              descricao: servico.nome,
              quantidade: item.quantidade,
              precoUnit: precoFinal,
              custoUnitario: 0,
              lucroUnitario: precoFinal,
              baseCalculo: fiscalCalc.baseCalculo,
              iva: fiscalCalc.taxaAplicadaPercentual,
              valorIva: fiscalCalc.valorIva,
              taxaAplicada: fiscalCalc.taxaAplicadaPercentual,
              tipoRegraFiscalSnapshot: fiscalCalc.tipoRegraFiscal as any,
              codigoRegraFiscal: fiscalCalc.codigoRegraFiscal,
              moedaTaxa: fiscalCalc.moedaTaxa,
              motivoIsencao: fiscalCalc.motivoIsencao,
              total: fiscalCalc.totalItem,
            });
            faturaItemsFiscais.push(fiscalCalc);
          }
        }

        // Calcular total da fatura usando utilitário
        const totalsFatura = FiscalCalculatorUtil.calcularFaturaTotal(faturaItemsFiscais);

        let troco = 0;
        if (data.metodoPagamento === "DINHEIRO") {
          if (data.valorRecebido == null || !Number.isFinite(data.valorRecebido)) {
            throw new Error("Informe o valor recebido para pagamento em dinheiro.");
          }
          if (data.valorRecebido < totalsFatura.total) {
            throw new Error("O valor recebido deve cobrir o total da venda.");
          }
          troco = FiscalCalculatorUtil.calcularTroco(data.valorRecebido, totalsFatura.total);
        }

        const responseItems = faturaItems.map((item) => ({
          tipo: item.servicoId ? "servico" : "produto",
          produtoId: item.produtoId ? item.produtoId.toString() : null,
          servicoId: item.servicoId ? item.servicoId.toString() : null,
          descricao: item.descricao,
          quantidade: Number(item.quantidade),
          precoUnit: Number(item.precoUnit),
          total: Number(item.total),
        }));

        // Simulação de QR Code (Em produção seria uma URL assinada pela AGT/Autoridade Fiscal)
        const mockQrCode = `https://skalway-pharm.ao/verify/fatura?n=${faturaNumero}&t=${totalsFatura.total.toFixed(2)}&d=${new Date().toISOString()}`;

        // 3. Criar Fatura com Itens e incluir itens no retorno para pegar IDs
        const tipoOperacao = this.resolveTipoOperacaoFiscal(faturaItemsFiscais);
        const fatura = await tx.fatura.create({
          data: {
            numero: faturaNumero,
            serie: new Date().getFullYear().toString(),
            tipo: "FR",
            clienteId,
            terminalId: BigInt(data.terminalId),
            userId: BigInt(data.userId),
            idempotencyKey: data.idempotencyKey ? `TERM-${data.terminalId}:${data.idempotencyKey}` : null,
            subtotal: totalsFatura.subtotal,
            ivaTotal: totalsFatura.ivaTotal,
            total: totalsFatura.total,
            valorRecebido:
              data.valorRecebido == null ? null : Number(data.valorRecebido),
            troco,
            tipoOperacao,
            tipoPagamento: data.metodoPagamento as any,
            estado: "PAGA",
            qrCode: mockQrCode,
            pagamentos: {
              create: {
                caixaId: caixa.id,
                metodo: data.metodoPagamento,
                valor: totalsFatura.total
              }
            }
          },
        });

        // 3.1 Criar Itens de Fatura e Dispensações vinculadas de forma determinística
        for (const itemData of faturaItems) {
          const { dispensacaoInfo, lotesUtilizados, ...faturaItemPayload } = itemData as any;
          const faturaItem = await tx.faturaItem.create({
            data: {
              ...faturaItemPayload,
              faturaId: fatura.id,
            },
          });

          if (lotesUtilizados?.length) {
            await replaceItemLoteAllocations(tx, faturaItem.id, lotesUtilizados);
          }
          const info = dispensacaoInfo;
          if (info) {
            const { receitaMetadata, ...cleanInfo } = info as any;
            
            const dispensacao = await tx.dispensacao.create({
              data: {
                ...cleanInfo,
                faturaId: fatura.id,
                faturaItemId: faturaItem.id,
                userId: BigInt(data.userId),
                idempotencyKey: `DISP-FAT-ITEM-${faturaItem.id}`
              }
            });

            if (cleanInfo.receitaId && requiresLivroReceita(cleanInfo.tipoDispensacao)) {
              await tx.livroReceita.create({
                data: {
                  dispensacaoId: dispensacao.id,
                  receitaId: cleanInfo.receitaId,
                  responsavelId: BigInt(data.userId),
                },
              });
            }

            if (cleanInfo.isPsicotropico) {
              await tx.livroPsicotropico.create({
                data: {
                  dispensacaoId: dispensacao.id,
                  responsavelId: BigInt(data.validatorUserId || data.userId),
                  tipoMovimento: "SAIDA",
                  numeroDocumento: receitaMetadata?.numeroReceita || `FAT-${fatura.numero}`,
                  idempotencyKey: `LP-DISP-${dispensacao.id}`,
                  observacoes: `Venda receita especial. Fatura #${fatura.numero} | Médico: ${receitaMetadata?.medicoNome || "N/A"}`,
                },
              });
            }
          }
        }

        // 4. Registrar no FINANCIAL LEDGER (Source of Truth Financeira) com Idempotência
        await tx.financialMovement.create({
          data: {
            userId: BigInt(data.userId),
            caixaId: caixa.id,
            faturaId: fatura.id,
            type: "SALE",
            amount: totalsFatura.total,
            reference: `Venda POS #${fatura.numero}`,
            idempotencyKey: `FIN-SALE-FAT-${fatura.id}`
          }
        });

        // Registrar Movimento Operacional de Caixa com Idempotência
        await tx.caixaMovimento.create({
          data: {
            caixaId: caixa.id,
            userId: BigInt(data.userId),
            faturaId: fatura.id,
            tipo: "ENTRADA",
            origem: "PAGAMENTO",
            valor: totalsFatura.total,
            saldoAnterior: caixa.saldoAtual,
            saldoFinal: Number(caixa.saldoAtual) + totalsFatura.total,
            idempotencyKey: `CAIXA-SALE-FAT-${fatura.id}`,
            descricao: `Venda POS #${fatura.numero}`
          }
        });

        // Atualizar Saldo do Caixa (Cache)
        await tx.caixa.update({
          where: { id: caixa.id },
          data: { 
            saldoAtual: { increment: totalsFatura.total },
            version: { increment: 1 }
          }
        });

        // 4.1 Atualizar Read Model (CashBalance) para performance de dashboard
        await tx.cashBalance.upsert({
          where: { caixaId: caixa.id },
          update: {
            saldoTotal: { increment: totalsFatura.total },
            saldoDinheiro: data.metodoPagamento === "DINHEIRO" ? { increment: totalsFatura.total } : undefined,
            saldoDigital: data.metodoPagamento !== "DINHEIRO" ? { increment: totalsFatura.total } : undefined,
          },
          create: {
            caixaId: caixa.id,
            saldoTotal: totalsFatura.total,
            saldoDinheiro: data.metodoPagamento === "DINHEIRO" ? totalsFatura.total : 0,
            saldoDigital: data.metodoPagamento !== "DINHEIRO" ? totalsFatura.total : 0,
          }
        });

        // 5. Compliance & Audit
        const complianceService = new ComplianceAuditService();
        await complianceService.createImmutableLog({
          userId: data.userId,
          action: "FINALIZAR_VENDA_POS",
          entity: "Fatura",
          entityId: fatura.id.toString(),
          after: { total: totalsFatura.total.toString(), items: faturaItems.length },
        }, tx);

        // 6. Registrar Business Event (EVENT SOURCING)
        await tx.businessEvent.create({
          data: {
            userId: BigInt(data.userId),
            type: "SALE_CREATED",
            entity: "Fatura",
            entityId: fatura.id,
            payload: serializeForJson({
              action: "SALE",
              faturaId: fatura.id.toString(),
              numero: fatura.numero,
              total: totalsFatura.total.toString(),
              itemsCount: faturaItems.length,
              terminal: terminal.nome,
              timestamp: new Date().toISOString(),
            }),
          }
        });

        await this.cleanupCheckoutDraftArtifacts(
          tx,
          fatura.id,
          data.idempotencyKey,
          produtosDoCarrinho,
        );
        const nextCartIdempotencyKey = await draftCartService.buildFreshCartKey(
          tx,
          data.userId,
        );

        return {
          success: true,
          faturaId: fatura.id.toString(),
          numero: fatura.numero,
          tipo: fatura.tipo,
          documentMode: fatura.tipo === "FR" ? "thermal_80mm" : "pdf_a4",
          estado: fatura.estado,
          subtotal: Number(fatura.subtotal),
          ivaTotal: Number(fatura.ivaTotal),
          total: Number(fatura.total),
          valorRecebido:
            fatura.valorRecebido == null ? null : Number(fatura.valorRecebido),
          troco: Number(fatura.troco),
          items: responseItems,
          cartReset: true,
          nextCartIdempotencyKey,
        };
      });
    } catch (error: any) {
      if (error.code === 'P2002' || error.message.includes('deadlock') || error.message.includes('lock wait timeout')) {
        throw new Error("O sistema está processando muitas vendas simultâneas. Por favor, tente novamente em instantes.");
      }
      throw error;
    }
  }

  private resolveReceitaPayload(data: FinalizarVendaDTO) {
    const pacienteNid = data.paciente?.nid?.trim();
    const itemComReceita = data.items?.find((item) => item.receita);
    const numero =
      data.receita?.numero?.trim() ||
      itemComReceita?.receita?.numero?.trim() ||
      pacienteNid;
    const medicoNome =
      data.receita?.medicoNome?.trim() ||
      data.receita?.prescritor?.trim() ||
      itemComReceita?.receita?.medicoNome?.trim();
    const unidadeSanitaria = data.receita?.unidadeSanitaria?.trim();

    if (!numero && !medicoNome && !unidadeSanitaria) {
      return null;
    }

    return {
      numero,
      medicoNome,
      unidadeSanitaria,
    };
  }

  private resolvePrescriptionPatientPayload(
    data: FinalizarVendaDTO,
    nomeClienteVenda: string,
  ) {
    const nome = data.paciente?.nome?.trim() || nomeClienteVenda;
    const nid = data.paciente?.nid?.trim() || null;
    const idadeRaw = data.paciente?.idade;
    const idade =
      idadeRaw == null || !Number.isFinite(Number(idadeRaw))
        ? null
        : Number(idadeRaw);

    return {
      nome,
      idade:
        idade != null &&
        idade > 0 &&
        idade <= FinalizarVendaUseCase.MAX_PATIENT_AGE
          ? idade
          : null,
      nid,
    };
  }

  private resolveTipoOperacaoFiscal(faturaItemsFiscais: TaxRuleSnapshot[] | any[]) {
    if (faturaItemsFiscais.some((item) => Number(item.valorIva ?? 0) > 0)) {
      return "TRIBUTADA" as const;
    }
    if (
      faturaItemsFiscais.length > 0 &&
      faturaItemsFiscais.every((item) => item.tipoRegraFiscal === "NAO_TRIBUTAVEL")
    ) {
      return "NAO_SUJEITA" as const;
    }
    return "ISENTA" as const;
  }

  private logStockCheckpoint(label: string, payload: Record<string, unknown>) {
    console.info(`[${label}]`, payload);
  }

  private async cleanupCheckoutDraftArtifacts(
    tx: any,
    faturaId: bigint,
    currentCartIdempotencyKey?: string,
    soldProdutoIds: bigint[] = [],
  ) {
    const reservationsToClear = await tx.estoqueReserva.findMany({
      where: { faturaId },
      select: { produtoId: true },
    });

    const productIdsToSync = new Set<bigint>(soldProdutoIds);
    for (const reserva of reservationsToClear) {
      productIdsToSync.add(reserva.produtoId);
    }

    const finalizedReservations = await tx.estoqueReserva.deleteMany({
      where: { faturaId },
    });
    let deletedDraftItems = 0;
    let deletedDraftReservations = 0;
    let deletedDraftFatura = false;

    if (currentCartIdempotencyKey) {
      const draftFatura = await tx.fatura.findFirst({
        where: {
          idempotencyKey: currentCartIdempotencyKey,
          estado: "RASCUNHO",
        },
        select: { id: true },
      });

      if (draftFatura) {
        const draftReservations = await tx.estoqueReserva.findMany({
          where: { faturaId: draftFatura.id },
          select: { produtoId: true },
        });
        for (const reserva of draftReservations) {
          productIdsToSync.add(reserva.produtoId);
        }

        const deletedItems = await tx.faturaItem.deleteMany({
          where: { faturaId: draftFatura.id },
        });
        deletedDraftItems = deletedItems.count;

        const deletedReservations = await tx.estoqueReserva.deleteMany({
          where: { faturaId: draftFatura.id },
        });
        deletedDraftReservations = deletedReservations.count;

        await tx.fatura.delete({
          where: { id: draftFatura.id },
        });
        deletedDraftFatura = true;
      }
    }

    this.logStockCheckpoint("POS_CHECKOUT_CART_RESET", {
      faturaId: faturaId.toString(),
      currentCartIdempotencyKey: currentCartIdempotencyKey ?? null,
      deletedFinalizedReservations: finalizedReservations.count,
      deletedDraftItems,
      deletedDraftReservations,
      deletedDraftFatura,
      syncedProdutoIds: [...productIdsToSync].map((id) => id.toString()),
    });

    for (const produtoId of productIdsToSync) {
      await syncStockBalanceCache(tx, produtoId);
    }
  }
}
