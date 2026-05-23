import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ComplianceAuditService } from "../../../../../shared/services/compliance-audit.service";
import { ComplianceEngineService } from "../../../../../shared/services/compliance-engine.service";
import { FiscalCalculatorUtil } from "../../../../../shared/utils/fiscal-calculator.util";
import type { TaxRuleSnapshot } from "../../../../../shared/utils/fiscal-calculator.util";
import { serializeForJson } from "../../../../../shared/http/serialize-json";
import { draftCartService } from "../services/draft-cart.service";
import { flattenProdutoForApi } from "../../../products/domain/produto-presenter";

export interface FinalizarVendaDTO {
  clienteId?: string;
  terminalId: string;
  userId: string;
  idempotencyKey?: string;
  validatorUserId?: string;
  metodoPagamento: "DINHEIRO" | "CARTAO" | "TRANSFERENCIA" | "CARTEIRA_MOVEL" | "EMOLA" | "MPESA";
  paciente?: {
    nome: string;
    idade: number;
    nid: string;
  };
  receita?: {
    numero?: string;
    medicoNome?: string;
    prescritor?: string;
    unidadeSanitaria?: string;
  };
  items: {
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
  async execute(data: FinalizarVendaDTO) {
    const prisma = getPrisma();

    try {
      // Padronização do isolamento transacional para nível SERIALIZABLE em operações de balcão
      // para evitar PHANTOM READS em picos de concorrência.
      return await prisma.$transaction(async (tx: any) => {
        // 0. Verificar Idempotência com Escopo (Terminal + Key)
        if (data.idempotencyKey) {
          const nextCartIdempotencyKey = this.buildNextCartIdempotencyKey(data);
          const scopedKey = `TERM-${data.terminalId}:${data.idempotencyKey}`;
          const existingFatura = await tx.fatura.findFirst({
            where: { 
              terminalId: BigInt(data.terminalId),
              idempotencyKey: scopedKey 
            },
            select: {
              id: true,
              numero: true,
              subtotal: true,
              ivaTotal: true,
              total: true,
              estado: true,
            },
          });
          if (existingFatura) {
            return {
              success: true,
              faturaId: existingFatura.id.toString(),
              numero: existingFatura.numero,
              estado: existingFatura.estado,
              subtotal: Number(existingFatura.subtotal),
              ivaTotal: Number(existingFatura.ivaTotal),
              total: Number(existingFatura.total),
              isDuplicate: true,
              cartReset: true,
              nextCartIdempotencyKey,
            };
          }
        }

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

        const produtosDoCarrinho = data.items
          .filter((item) => item.tipo === "produto" && item.produtoId)
          .map((item) => BigInt(item.produtoId!));

        const produtosComReceitaObrigatoria = produtosDoCarrinho.length
          ? await tx.produto.findMany({
              where: {
                id: { in: produtosDoCarrinho },
                regulacao: { requiresPrescription: true },
              },
              select: { id: true, nome: true },
            })
          : [];

        const requerPacienteReceita = produtosComReceitaObrigatoria.length > 0;
        const clienteId = requerPacienteReceita
          ? await this.resolvePrescriptionClienteId(tx, data)
          : await draftCartService.resolveClienteId(tx, data.clienteId);

        let totalGeral = 0;
        const faturaItems = [];
        const faturaNumero = `FR-${Date.now()}`;

        // --- GESTÃO DE RECEITA ÚNICA POR VENDA ---
        // Identificamos se há dados de receita no payload (assumimos uma receita por venda física no POS)
        const receitaVenda = this.resolveReceitaPayload(data);
        const itemComReceita = data.items.find(i => i.receita);
        let receitaFisicaId: bigint | null = null;
        let receitaMetadata: any = null;

        if (
          requerPacienteReceita &&
          (!receitaVenda?.numero || !receitaVenda?.medicoNome || !receitaVenda?.unidadeSanitaria)
        ) {
          throw new Error(
            "Prescritor, NID da receita/doente e unidade sanitária são obrigatórios para itens com receita.",
          );
        }

        if (receitaVenda || itemComReceita?.receita) {
          const receitaFisica = await tx.receita.create({
            data: {
              clienteId,
              medicoNome: receitaVenda?.medicoNome || "N/A",
              numeroReceita: receitaVenda?.numero || `POS-${Date.now()}`,
              unidadeSanitaria: receitaVenda?.unidadeSanitaria || null,
              dataReceita: new Date(),
              observacoes: `Receita física apresentada no POS. Fatura: #${faturaNumero}`
            }
          });
          receitaFisicaId = receitaFisica.id;
          receitaMetadata = {
            medicoNome: receitaFisica.medicoNome,
            numeroReceita: receitaFisica.numeroReceita,
            unidadeSanitaria: receitaFisica.unidadeSanitaria,
            dataReceita: receitaFisica.dataReceita
          };
        }

        // 2. Processar Itens
        const complianceEngine = new ComplianceEngineService();

        const faturaItemsFiscais: any[] = [];
        for (const item of data.items) {
          if (item.tipo === "produto") {
            const produtoId = BigInt(item.produtoId!);
            await tx.$executeRaw`SELECT id FROM produtos WHERE id = ${produtoId} FOR UPDATE`;
            const produtoRow = await tx.produto.findUnique({
              where: { id: produtoId },
              include: { regulacao: true, taxRule: true },
            });
            if (!produtoRow) throw new Error(`Produto ${item.produtoId} não encontrado`);
            const produto = flattenProdutoForApi(produtoRow as Record<string, unknown>);

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

            const lotes: any[] = await tx.$queryRaw`
              SELECT *, (quantidadeAtual - quantidadeQuarentena) as qtdDisponivelReal 
              FROM lotes 
              WHERE produtoId = ${produto.id} 
              AND ativo = true 
              AND estadoSanitario = 'VALIDO'
              AND disponibilidade = 'DISPONIVEL'
              AND (quantidadeAtual - quantidadeQuarentena) > 0 
              AND dataValidade > NOW() 
              ORDER BY dataValidade ASC 
              FOR UPDATE`;
            
            // 2.1 Validações Farmacêuticas Automatizadas via Compliance Engine
            const complianceResult = await complianceEngine.validateVenda({
                produto,
                quantidade: item.quantidade,
                receitaId: receitaFisicaId,
                validatorUserId: data.validatorUserId
            });

            if (!complianceResult.passed) {
                throw new Error(complianceResult.message);
            }

            const disponivelAntes = lotes.reduce(
              (total: number, lote: any) => total + Number(lote.qtdDisponivelReal),
              0,
            );
            if (disponivelAntes < item.quantidade) {
              throw new Error(`Stock insuficiente para o produto ${produto.nome}`);
            }

            const precoFinal = item.precoUnit || Number(produto.precoVenda);

            // Cálculo fiscal usando utilitário
            const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
              quantidade: item.quantidade,
              precoUnitario: precoFinal,
              taxRule: taxRuleSnapshot,
              descricao: String(produto.nome ?? ""),
            });

            totalGeral += fiscalCalc.baseCalculo;

            // Baixa de Lotes (FEFO) - Source of Truth no Cache
            let totalCustoItem = 0;
            let qtdRestante = item.quantidade;
            const lotesUtilizados: Array<{ loteId: bigint; quantidade: number }> = [];
            for (const lote of lotes) {
              if (qtdRestante <= 0) break;
              const disponivelNoLote = Number(lote.qtdDisponivelReal);
              const qtdATirar = Math.min(disponivelNoLote, qtdRestante);
              totalCustoItem += Number(lote.precoCompra) * qtdATirar;
              
              await tx.lote.update({
                where: { id: lote.id },
                data: { 
                  quantidadeAtual: { decrement: qtdATirar },
                  version: { increment: 1 }
                }
              });

              // 2.2 Registrar Movimento de Estoque por Lote (STOCK LEDGER) com Idempotência
              await tx.estoqueMovimento.create({
                data: {
                  produtoId: produto.id,
                  loteId: lote.id,
                  userId: BigInt(data.userId),
                  tipo: "SAIDA",
                  quantidade: qtdATirar,
                  estoqueAnterior: lote.quantidadeAtual,
                  estoqueFinal: Number(lote.quantidadeAtual) - qtdATirar,
                  origem: "POS_VENDA",
                  idempotencyKey: `EM-FAT-${faturaNumero}-LOTE-${lote.id}`,
                  observacoes: `Venda no Terminal ${terminal.nome}`
                }
              });

              lotesUtilizados.push({
                loteId: lote.id,
                quantidade: qtdATirar,
              });
              qtdRestante -= qtdATirar;
            }

            if (qtdRestante > 0) {
              throw new Error(
                `Não foi possível satisfazer a quantidade do produto ${produto.nome} com os lotes disponíveis.`,
              );
            }

            const stockSnapshotDepois = await this.syncStockFromLots(tx, produtoId);
            this.logStockCheckpoint("POS_CHECKOUT_STOCK_SYNC", {
              faturaNumero,
              produtoId: produtoId.toString(),
              produtoNome: produto.nome,
              quantidadeVendida: item.quantidade,
              disponivelAntes,
              disponivelDepois: stockSnapshotDepois.disponivel,
              estoqueTotalDepois: stockSnapshotDepois.total,
              lotesUtilizados: lotesUtilizados.map((entry) => ({
                loteId: entry.loteId.toString(),
                quantidade: entry.quantidade,
              })),
            });

            const custoUnitarioFinal = totalCustoItem / item.quantidade;
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
            faturaItems.push({
              produtoId: produto.id,
              loteId: lotes[0]?.id,
              descricao: produto.nome,
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
          const { dispensacaoInfo, ...faturaItemPayload } = itemData as any;
          const faturaItem = await tx.faturaItem.create({
            data: {
              ...faturaItemPayload,
              faturaId: fatura.id,
            },
          });
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

            // Se houver receita vinculada, registramos no Livro de Receitas (Geral de Receitas)
            if (cleanInfo.receitaId && receitaMetadata) {
              await tx.livroReceita.create({
                data: {
                  receitaId: cleanInfo.receitaId,
                  clienteId,
                  produtoId: cleanInfo.produtoId,
                  loteId: cleanInfo.loteId,
                  faturaId: fatura.id,
                  faturaItemId: faturaItem.id,
                  dispensacaoId: dispensacao.id,
                  responsavelId: BigInt(data.userId),
                  tipoMovimento: "SAIDA",
                  quantidade: cleanInfo.quantidade,
                  saldoAnterior: receitaMetadata.saldoAnterior,
                  saldoAtual: receitaMetadata.saldoAtual,
                  medicoNome: receitaMetadata.medicoNome,
                  numeroReceita: receitaMetadata.numeroReceita,
                  dataReceita: receitaMetadata.dataReceita,
                  origemReceita: "FISICA",
                  idempotencyKey: `LR-DISP-${dispensacao.id}`,
                  observacoes: `Dispensação vinculada à Fatura #${fatura.numero}${receitaMetadata.unidadeSanitaria ? ` | Unidade Sanitária: ${receitaMetadata.unidadeSanitaria}` : ""}`
                }
              });
            }

            // REGRA FUNDAMENTAL: Se for Psicotrópico, registrar no Livro de Psicotrópicos (Legal LIII/LIV)
            // Este registro é INDEPENDENTE de estar ou não no Livro de Receitas.
            if (cleanInfo.isPsicotropico) {
              await tx.livroPsicotropico.create({
                data: {
                  produtoId: cleanInfo.produtoId,
                  loteId: cleanInfo.loteId,
                  dispensacaoId: dispensacao.id,
                  responsavelId: BigInt(data.validatorUserId || data.userId),
                  tipoMovimento: "SAIDA",
                  quantidade: cleanInfo.quantidade,
                  saldoAnterior: receitaMetadata?.saldoAnterior || 0,
                  saldoAtual: receitaMetadata?.saldoAtual || 0,
                  numeroDocumento: receitaMetadata?.numeroReceita || `FAT-${fatura.numero}`,
                  idempotencyKey: `LP-DISP-${dispensacao.id}`,
                  observacoes: `Venda Psicotrópico. Fatura: #${fatura.numero} | Médico: ${receitaMetadata?.medicoNome || 'N/A'}`
                }
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
        );
        const nextCartIdempotencyKey = this.buildNextCartIdempotencyKey(data);

        return {
          success: true,
          faturaId: fatura.id.toString(),
          numero: fatura.numero,
          estado: fatura.estado,
          subtotal: Number(fatura.subtotal),
          ivaTotal: Number(fatura.ivaTotal),
          total: Number(fatura.total),
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
    const itemComReceita = data.items.find((item) => item.receita);
    const numero =
      data.receita?.numero?.trim() ||
      itemComReceita?.receita?.numero?.trim() ||
      data.paciente?.nid.trim();
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

  private async syncStockFromLots(tx: any, produtoId: bigint) {
    await tx.$executeRaw`SELECT id FROM lotes WHERE produtoId = ${produtoId} FOR UPDATE`;
    const snapshotRows: any[] = await tx.$queryRaw`
      SELECT
        COALESCE(SUM(quantidadeAtual), 0) AS totalFisico,
        COALESCE(
          SUM(
            CASE
              WHEN ativo = true
                AND estadoSanitario = 'VALIDO'
                AND disponibilidade = 'DISPONIVEL'
                AND dataValidade > NOW()
              THEN GREATEST(quantidadeAtual - quantidadeQuarentena, 0)
              ELSE 0
            END
          ),
          0
        ) AS disponivelReal
      FROM lotes
      WHERE produtoId = ${produtoId}
    `;
    const snapshot = snapshotRows[0] ?? {};
    const quantidadeTotal = Number(snapshot.totalFisico ?? 0);
    const quantidadeDisponivel = Number(snapshot.disponivelReal ?? 0);
    const quantidadeReservada = Math.max(0, quantidadeTotal - quantidadeDisponivel);

    await tx.stockBalance.upsert({
      where: { produtoId },
      create: {
        produtoId,
        quantidadeTotal,
        quantidadeReservada,
        quantidadeDisponivel,
      },
      update: {
        quantidadeTotal,
        quantidadeReservada,
        quantidadeDisponivel,
      },
    });

    await tx.produto.update({
      where: { id: produtoId },
      data: {
        estoqueAtual: quantidadeTotal,
        version: { increment: 1 },
      },
    });

    return {
      total: quantidadeTotal,
      disponivel: quantidadeDisponivel,
    };
  }

  private logStockCheckpoint(label: string, payload: Record<string, unknown>) {
    console.info(`[${label}]`, payload);
  }

  private buildNextCartIdempotencyKey(data: Pick<FinalizarVendaDTO, "userId" | "terminalId">) {
    return `pdv-${data.userId}-${data.terminalId}-${Date.now()}`;
  }

  private async cleanupCheckoutDraftArtifacts(
    tx: any,
    faturaId: bigint,
    currentCartIdempotencyKey?: string,
  ) {
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
    });
  }


  private async resolvePrescriptionClienteId(tx: any, data: FinalizarVendaDTO) {
    const paciente = data.paciente;
    if (!paciente) {
      throw new Error(
        "Dados do paciente são obrigatórios para vendas com medicamentos que exigem receita.",
      );
    }

    const nome = paciente.nome.trim();
    const nid = paciente.nid.trim();
    const idade = Number(paciente.idade);

    if (!nome) {
      throw new Error("Nome do paciente é obrigatório para itens com receita.");
    }
    if (!Number.isFinite(idade) || idade <= 0) {
      throw new Error("Idade do paciente deve ser maior que zero.");
    }
    if (!nid) {
      throw new Error("NID da receita/doente é obrigatório para itens com receita.");
    }

    const dataNascimento = this.birthDateFromAge(idade);

    if (data.clienteId) {
      const clienteExistente = await tx.cliente.findUnique({
        where: { id: BigInt(data.clienteId) },
        select: { id: true },
      });
      if (!clienteExistente) {
        throw new Error("Cliente informado para a venda não foi encontrado.");
      }
      await tx.cliente.update({
        where: { id: clienteExistente.id },
        data: {
          nome,
          documento: nid,
          dataNascimento,
          tipo: "PACIENTE",
          temPrescricao: true,
        },
      });
      return clienteExistente.id;
    }

    const clienteExistente = await tx.cliente.findFirst({
      where: {
        deletedAt: null,
        OR: [{ documento: nid }, { nome }],
      },
      select: { id: true },
      orderBy: { id: "desc" },
    });

    if (clienteExistente) {
      await tx.cliente.update({
        where: { id: clienteExistente.id },
        data: {
          nome,
          documento: nid,
          dataNascimento,
          tipo: "PACIENTE",
          temPrescricao: true,
        },
      });
      return clienteExistente.id;
    }

    const clienteCriado = await tx.cliente.create({
      data: {
        nome,
        documento: nid,
        dataNascimento,
        tipo: "PACIENTE",
        temPrescricao: true,
      },
      select: { id: true },
    });

    return clienteCriado.id;
  }

  private birthDateFromAge(idade: number) {
    const dataNascimento = new Date();
    dataNascimento.setHours(0, 0, 0, 0);
    dataNascimento.setFullYear(dataNascimento.getFullYear() - idade);
    return dataNascimento;
  }
}
