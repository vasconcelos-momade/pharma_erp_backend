import {
  FiscalCalculatorUtil,
  type TaxRuleSnapshot,
} from "../../../../../shared/utils/fiscal-calculator.util";
import type {
  DraftCartItemInput,
  DraftCartItemView,
  DraftCartMutationContext,
  DraftCartProdutoItemInput,
  DraftCartServicoItemInput,
  DraftCartView,
} from "./draft-cart.types";
import { isDraftCartServicoItem } from "./draft-cart.types";
import { mapPosProduto } from "../../../products/domain/produto-presenter";
import { getQuantidadeDisponivel } from "../../../stock/domain/produto-stock.service";
import {
  resolveProdutoPrecoVendaFromRow,
  resolveServicoPrecoFromRow,
} from "./pos-pricing.service";

export class DraftCartService {

  async assertCaixaAberta(tx: any, userId: string) {
    const sessao = await tx.caixaSessao.findFirst({
      where: { userId: BigInt(userId), status: "ABERTA" },
    });
    if (!sessao) {
      throw new Error(
        "Você não possui uma sessão de caixa aberta. Por favor, abra o caixa antes de operar o carrinho.",
      );
    }
    return sessao;
  }

  async resolveClienteId(tx: any, clienteId?: string): Promise<bigint> {
    if (clienteId) {
      return BigInt(clienteId);
    }
    const existing = await tx.cliente.findFirst({
      where: { nome: "Cliente Final (Consumidor)", deletedAt: null },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    if (existing) {
      return existing.id;
    }
    const created = await tx.cliente.create({
      data: { nome: "Cliente Final (Consumidor)", tipo: "PACIENTE" },
      select: { id: true },
    });
    return created.id;
  }

  async resolveTerminalId(tx: any, terminalId?: string): Promise<bigint | null> {
    if (terminalId) {
      return BigInt(terminalId);
    }
    const terminal = await tx.terminal.findFirst({
      where: { ativo: true, deletedAt: null },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    return terminal?.id ?? null;
  }

  async resolveOrCreateFatura(tx: any, ctx: DraftCartMutationContext) {
    await this.assertCaixaAberta(tx, ctx.userId);

    const existing = await tx.fatura.findUnique({
      where: { idempotencyKey: ctx.idempotencyKey },
      select: { id: true, estado: true },
    });

    if (existing) {
      if (existing.estado !== "RASCUNHO") {
        throw new Error("A fatura associada ao carrinho não está em rascunho.");
      }
      return { id: existing.id };
    }

    const clienteId = await this.resolveClienteId(tx, ctx.clienteId);
    const terminalId = await this.resolveTerminalId(tx, ctx.terminalId);
    const now = Date.now();

    return tx.fatura.create({
      data: {
        numero: `DRAFT-${now}`,
        serie: new Date().getFullYear().toString(),
        clienteId,
        terminalId,
        userId: BigInt(ctx.userId),
        idempotencyKey: ctx.idempotencyKey,
        subtotal: 0,
        ivaTotal: 0,
        total: 0,
        estado: "RASCUNHO",
      },
      select: { id: true },
    });
  }

  reservaKey(idempotencyKey: string, produtoId: bigint | string, loteId: bigint | null) {
    return `RES-${idempotencyKey}-${produtoId}-${loteId ?? "NONE"}`;
  }

  async loadProdutoForUpdate(tx: any, produtoId: string) {
    const produtos: any[] =
      await tx.$queryRaw`SELECT * FROM produtos WHERE id = ${BigInt(produtoId)} FOR UPDATE`;
    const produto = produtos[0];
    if (!produto) {
      throw new Error(`Produto ${produtoId} não encontrado`);
    }
    return produto;
  }

  /** PDV: produto só entra no carrinho com preço de venda configurado (> 0). */
  assertProdutoPrecoVendaVendavel(produto: { nome?: string; precoVenda?: unknown; preco_venda?: unknown }) {
    resolveProdutoPrecoVendaFromRow(produto);
  }

  async loadTaxRuleSnapshot(tx: any, entity: { taxRuleId?: bigint | null }): Promise<TaxRuleSnapshot | null> {
    if (!entity.taxRuleId) {
      return null;
    }
    const taxRule = await tx.taxRule.findUnique({
      where: { id: BigInt(entity.taxRuleId) },
    });
    if (!taxRule) {
      return null;
    }
    return {
      tipo: taxRule.tipo,
      taxa: Number(taxRule.taxa),
      codigo: taxRule.codigo,
      descricao: taxRule.descricao ?? undefined,
    };
  }

  async loadServicoForUpdate(tx: any, servicoId: string) {
    const servico = await tx.servico.findUnique({
      where: { id: BigInt(servicoId) },
      include: { taxRule: true },
    });
    if (!servico) {
      throw new Error(`Serviço ${servicoId} não encontrado`);
    }
    if (!servico.ativo) {
      throw new Error(`O serviço «${servico.nome}» está inativo e não pode ser vendido.`);
    }
    return servico;
  }

  assertServicoPrecoVendavel(servico: { nome?: string; preco?: unknown }) {
    resolveServicoPrecoFromRow(servico);
  }

  taxRuleSnapshotFromServico(servico: { taxRule?: { tipo: string; taxa: unknown; codigo: string; descricao?: string | null } | null }): TaxRuleSnapshot | null {
    const taxRule = servico.taxRule;
    if (!taxRule) {
      return null;
    }
    return {
      tipo: taxRule.tipo as TaxRuleSnapshot["tipo"],
      taxa: Number(taxRule.taxa),
      codigo: taxRule.codigo,
      descricao: taxRule.descricao ?? undefined,
    };
  }

  async resolveDraftFaturaOrThrow(tx: any, idempotencyKey: string) {
    const fatura = await tx.fatura.findUnique({
      where: { idempotencyKey },
      select: { id: true, estado: true },
    });
    if (!fatura || fatura.estado !== "RASCUNHO") {
      throw new Error("Carrinho rascunho não encontrado. Adicione um item primeiro.");
    }
    return fatura;
  }

  async getDisponivel(tx: any, produto: { id: bigint }): Promise<number> {
    return getQuantidadeDisponivel(tx, produto.id);
  }

  async reserveStock(
    tx: any,
    params: {
      faturaId: bigint;
      produto: any;
      loteId: bigint | null;
      delta: number;
      idempotencyKey: string;
    },
  ) {
    const { faturaId, produto, loteId, delta, idempotencyKey } = params;
    const disponivel = await this.getDisponivel(tx, produto);
    if (disponivel < delta) {
      throw new Error(
        `Stock insuficiente (disponível: ${disponivel}) para o produto ${produto.nome}`,
      );
    }

    const estoqueAtual = Number(produto.estoqueAtual ?? produto.estoque_atual ?? 0);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const key = this.reservaKey(idempotencyKey, produto.id, loteId);

    await tx.estoqueReserva.upsert({
      where: { idempotencyKey: key },
      update: {
        quantidade: { increment: delta },
        expiresAt,
        faturaId,
      },
      create: {
        faturaId,
        produtoId: produto.id,
        loteId,
        quantidade: delta,
        idempotencyKey: key,
        expiresAt,
      },
    });

    await tx.stockBalance.upsert({
      where: { produtoId: produto.id },
      update: {
        quantidadeReservada: { increment: delta },
        quantidadeDisponivel: { decrement: delta },
      },
      create: {
        produtoId: produto.id,
        quantidadeTotal: estoqueAtual,
        quantidadeReservada: delta,
        quantidadeDisponivel: estoqueAtual - delta,
      },
    });
  }

  async releaseStock(
    tx: any,
    params: {
      produtoId: bigint;
      loteId: bigint | null;
      quantidade: number;
      idempotencyKey: string;
    },
  ) {
    const { produtoId, loteId, quantidade, idempotencyKey } = params;
    const key = this.reservaKey(idempotencyKey, produtoId, loteId);

    const reserva = await tx.estoqueReserva.findUnique({
      where: { idempotencyKey: key },
    });

    if (reserva) {
      const reservaQty = Number(reserva.quantidade);
      if (reservaQty <= quantidade) {
        await tx.estoqueReserva.delete({ where: { idempotencyKey: key } });
      } else {
        await tx.estoqueReserva.update({
          where: { idempotencyKey: key },
          data: { quantidade: { decrement: quantidade } },
        });
      }
    }

    await tx.stockBalance.updateMany({
      where: { produtoId },
      data: {
        quantidadeReservada: { decrement: quantidade },
        quantidadeDisponivel: { increment: quantidade },
      },
    });
  }

  async addCartItemDelta(
    tx: any,
    faturaId: bigint,
    ctx: DraftCartMutationContext,
    item: DraftCartItemInput,
  ) {
    if (isDraftCartServicoItem(item)) {
      return this.addServicoDelta(tx, faturaId, ctx, item);
    }
    return this.addItemDelta(tx, faturaId, ctx, item);
  }

  async addItemDelta(
    tx: any,
    faturaId: bigint,
    ctx: DraftCartMutationContext,
    item: DraftCartProdutoItemInput,
  ) {
    const delta = item.quantidade;
    if (!Number.isFinite(delta) || delta <= 0) {
      throw new Error("Quantidade inválida.");
    }

    const produto = await this.loadProdutoForUpdate(tx, item.produtoId);
    this.assertProdutoPrecoVendaVendavel(produto);

    const preco = resolveProdutoPrecoVendaFromRow(produto);

    const loteId = item.loteId ? BigInt(item.loteId) : null;

    await this.reserveStock(tx, {
      faturaId,
      produto,
      loteId,
      delta,
      idempotencyKey: ctx.idempotencyKey,
    });

    const existingItem = await tx.faturaItem.findFirst({
      where: { faturaId, produtoId: produto.id, loteId },
      select: { id: true, quantidade: true },
    });

    if (existingItem) {
      const nextQty = Number(existingItem.quantidade) + delta;
      const taxRuleSnapshot = await this.loadTaxRuleSnapshot(tx, produto);
      const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
        quantidade: nextQty,
        precoUnitario: preco,
        taxRule: taxRuleSnapshot,
        descricao: produto.nome,
      });
      await tx.faturaItem.update({
        where: { id: existingItem.id },
        data: {
          descricao: produto.nome,
          quantidade: nextQty,
          precoUnit: preco,
          baseCalculo: fiscalCalc.baseCalculo,
          valorIva: fiscalCalc.valorIva,
          total: fiscalCalc.totalItem,
          iva: fiscalCalc.taxaAplicadaPercentual,
          taxaAplicada: fiscalCalc.taxaAplicadaPercentual,
          tipoRegraFiscalSnapshot: fiscalCalc.tipoRegraFiscal,
          codigoRegraFiscal: fiscalCalc.codigoRegraFiscal,
        },
      });
    } else {
      const taxRuleSnapshot = await this.loadTaxRuleSnapshot(tx, produto);
      const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
        quantidade: delta,
        precoUnitario: preco,
        taxRule: taxRuleSnapshot,
        descricao: produto.nome,
      });
      await tx.faturaItem.create({
        data: {
          faturaId,
          produtoId: produto.id,
          loteId,
          descricao: produto.nome,
          quantidade: delta,
          precoUnit: preco,
          baseCalculo: fiscalCalc.baseCalculo,
          iva: fiscalCalc.taxaAplicadaPercentual,
          valorIva: fiscalCalc.valorIva,
          total: fiscalCalc.totalItem,
          taxaAplicada: fiscalCalc.taxaAplicadaPercentual,
          tipoRegraFiscalSnapshot: fiscalCalc.tipoRegraFiscal,
          codigoRegraFiscal: fiscalCalc.codigoRegraFiscal,
        },
      });
    }
  }

  async addServicoDelta(
    tx: any,
    faturaId: bigint,
    _ctx: DraftCartMutationContext,
    item: DraftCartServicoItemInput,
  ) {
    const delta = item.quantidade;
    if (!Number.isFinite(delta) || delta <= 0) {
      throw new Error("Quantidade inválida.");
    }

    const servico = await this.loadServicoForUpdate(tx, item.servicoId);
    this.assertServicoPrecoVendavel(servico);

    const preco = resolveServicoPrecoFromRow(servico);

    const existingItem = await tx.faturaItem.findFirst({
      where: { faturaId, servicoId: servico.id },
      select: { id: true, quantidade: true },
    });

    if (existingItem) {
      const nextQty = Number(existingItem.quantidade) + delta;
      const taxRuleSnapshot = this.taxRuleSnapshotFromServico(servico);
      const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
        quantidade: nextQty,
        precoUnitario: preco,
        taxRule: taxRuleSnapshot,
        descricao: servico.nome,
      });
      await tx.faturaItem.update({
        where: { id: existingItem.id },
        data: {
          descricao: servico.nome,
          quantidade: nextQty,
          precoUnit: preco,
          baseCalculo: fiscalCalc.baseCalculo,
          valorIva: fiscalCalc.valorIva,
          total: fiscalCalc.totalItem,
          iva: fiscalCalc.taxaAplicadaPercentual,
          taxaAplicada: fiscalCalc.taxaAplicadaPercentual,
          tipoRegraFiscalSnapshot: fiscalCalc.tipoRegraFiscal,
          codigoRegraFiscal: fiscalCalc.codigoRegraFiscal,
        },
      });
    } else {
      const taxRuleSnapshot = this.taxRuleSnapshotFromServico(servico);
      const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
        quantidade: delta,
        precoUnitario: preco,
        taxRule: taxRuleSnapshot,
        descricao: servico.nome,
      });
      await tx.faturaItem.create({
        data: {
          faturaId,
          servicoId: servico.id,
          descricao: servico.nome,
          quantidade: delta,
          precoUnit: preco,
          baseCalculo: fiscalCalc.baseCalculo,
          iva: fiscalCalc.taxaAplicadaPercentual,
          valorIva: fiscalCalc.valorIva,
          total: fiscalCalc.totalItem,
          taxaAplicada: fiscalCalc.taxaAplicadaPercentual,
          tipoRegraFiscalSnapshot: fiscalCalc.tipoRegraFiscal,
          codigoRegraFiscal: fiscalCalc.codigoRegraFiscal,
        },
      });
    }
  }

  async incrementLineDelta(
    tx: any,
    faturaId: bigint,
    ctx: DraftCartMutationContext,
    faturaItem: any,
  ) {
    if (faturaItem.servicoId) {
      return this.addServicoDelta(tx, faturaId, ctx, {
        servicoId: faturaItem.servicoId.toString(),
        quantidade: 1,
      });
    }
    return this.addItemDelta(tx, faturaId, ctx, {
      produtoId: faturaItem.produtoId.toString(),
      loteId: faturaItem.loteId ? faturaItem.loteId.toString() : undefined,
      quantidade: 1,
    });
  }

  async decrementLineDelta(
    tx: any,
    faturaItem: any,
    ctx: DraftCartMutationContext,
  ) {
    const currentQty = Number(faturaItem.quantidade);
    if (currentQty <= 1) {
      await this.deleteItem(tx, faturaItem, ctx);
      return;
    }

    if (faturaItem.produtoId) {
      const produtoId = faturaItem.produtoId as bigint;
      const loteId = (faturaItem.loteId as bigint | null) ?? null;
      await this.releaseStock(tx, {
        produtoId,
        loteId,
        quantidade: 1,
        idempotencyKey: ctx.idempotencyKey,
      });
    }

    await this.setItemQuantity(tx, faturaItem, ctx, currentQty - 1);
  }

  async setItemQuantity(
    tx: any,
    faturaItem: any,
    ctx: DraftCartMutationContext,
    newQty: number,
  ) {
    if (faturaItem.servicoId) {
      const servico = await this.loadServicoForUpdate(tx, faturaItem.servicoId.toString());
      const preco = resolveServicoPrecoFromRow(servico);
      const taxRuleSnapshot = this.taxRuleSnapshotFromServico(servico);
      const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
        quantidade: newQty,
        precoUnitario: preco,
        taxRule: taxRuleSnapshot,
        descricao: servico.nome,
      });

      await tx.faturaItem.update({
        where: { id: faturaItem.id },
        data: {
          descricao: servico.nome,
          quantidade: newQty,
          precoUnit: preco,
          baseCalculo: fiscalCalc.baseCalculo,
          valorIva: fiscalCalc.valorIva,
          total: fiscalCalc.totalItem,
          iva: fiscalCalc.taxaAplicadaPercentual,
          taxaAplicada: fiscalCalc.taxaAplicadaPercentual,
          tipoRegraFiscalSnapshot: fiscalCalc.tipoRegraFiscal,
          codigoRegraFiscal: fiscalCalc.codigoRegraFiscal,
        },
      });
      return;
    }

    const produto = await this.loadProdutoForUpdate(tx, faturaItem.produtoId.toString());
    const preco = resolveProdutoPrecoVendaFromRow(produto);
    const taxRuleSnapshot = await this.loadTaxRuleSnapshot(tx, produto);
    const loteId = faturaItem.loteId as bigint | null;

    const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
      quantidade: newQty,
      precoUnitario: preco,
      taxRule: taxRuleSnapshot,
      descricao: produto.nome,
    });

    await tx.faturaItem.update({
      where: { id: faturaItem.id },
      data: {
        descricao: produto.nome,
        quantidade: newQty,
        precoUnit: preco,
        baseCalculo: fiscalCalc.baseCalculo,
        valorIva: fiscalCalc.valorIva,
        total: fiscalCalc.totalItem,
        iva: fiscalCalc.taxaAplicadaPercentual,
        taxaAplicada: fiscalCalc.taxaAplicadaPercentual,
        tipoRegraFiscalSnapshot: fiscalCalc.tipoRegraFiscal,
        codigoRegraFiscal: fiscalCalc.codigoRegraFiscal,
      },
    });

    const key = this.reservaKey(ctx.idempotencyKey, produto.id, loteId);
    const reserva = await tx.estoqueReserva.findUnique({ where: { idempotencyKey: key } });
    if (reserva) {
      if (newQty <= 0) {
        await tx.estoqueReserva.delete({ where: { idempotencyKey: key } });
      } else {
        await tx.estoqueReserva.update({
          where: { idempotencyKey: key },
          data: { quantidade: newQty, faturaId: faturaItem.faturaId },
        });
      }
    }
  }

  async deleteItem(
    tx: any,
    faturaItem: any,
    ctx: DraftCartMutationContext,
  ) {
    if (faturaItem.produtoId) {
      const qty = Number(faturaItem.quantidade);
      const produtoId = faturaItem.produtoId as bigint;
      const loteId = (faturaItem.loteId as bigint | null) ?? null;

      await this.releaseStock(tx, {
        produtoId,
        loteId,
        quantidade: qty,
        idempotencyKey: ctx.idempotencyKey,
      });
    }

    await tx.faturaItem.delete({ where: { id: faturaItem.id } });
  }

  async recalculateFaturaTotals(tx: any, faturaId: bigint) {
    const agg = await tx.faturaItem.aggregate({
      where: { faturaId },
      _sum: { baseCalculo: true, valorIva: true, total: true },
    });

    const subtotal = Number(agg._sum.baseCalculo ?? 0);
    const ivaTotal = Number(agg._sum.valorIva ?? 0);
    const total = Number(agg._sum.total ?? 0);

    return tx.fatura.update({
      where: { id: faturaId },
      data: { subtotal, ivaTotal, total },
    });
  }

  async getFaturaItemOrThrow(tx: any, faturaId: bigint, itemId: string) {
    const item = await tx.faturaItem.findFirst({
      where: { id: BigInt(itemId), faturaId },
    });
    if (!item) {
      throw new Error("Item do carrinho não encontrado.");
    }
    if (!item.produtoId && !item.servicoId) {
      throw new Error("Item do carrinho inválido.");
    }
    return item;
  }

  async buildCartView(tx: any, faturaId: bigint): Promise<DraftCartView> {
    const fatura = await tx.fatura.findUnique({
      where: { id: faturaId },
      include: {
        items: {
          orderBy: { id: "asc" },
        },
      },
    });

    if (!fatura) {
      throw new Error("Fatura rascunho não encontrada.");
    }

    const items: DraftCartItemView[] = [];

    for (const row of fatura.items) {
      if (row.servicoId) {
        const servico = await tx.servico.findUnique({
          where: { id: row.servicoId },
          select: {
            id: true,
            nome: true,
            tipoServicoClinico: true,
            taxRule: { select: { tipo: true, taxa: true, codigo: true } },
          },
        });

        items.push({
          id: row.id.toString(),
          tipo: "servico",
          produtoId: null,
          servicoId: row.servicoId.toString(),
          loteId: null,
          nome: row.descricao,
          quantidade: Number(row.quantidade),
          precoUnit: Number(row.precoUnit),
          baseCalculo: Number(row.baseCalculo),
          valorIva: Number(row.valorIva),
          total: Number(row.total),
          ivaPercentual: Number(row.iva),
          taxRule: servico?.taxRule
            ? {
                tipo: servico.taxRule.tipo,
                taxa: Number(servico.taxRule.taxa),
                codigo: servico.taxRule.codigo,
              }
            : null,
          requiresPrescription: false,
          estoqueAtual: null,
          estoqueDisponivel: null,
          tipoServicoClinico: servico?.tipoServicoClinico ?? null,
        });
        continue;
      }

      if (!row.produtoId) {
        continue;
      }

      const produtoRow = await tx.produto.findUnique({
        where: { id: row.produtoId },
        select: {
          id: true,
          nome: true,
          estoqueAtual: true,
          regulacao: true,
          taxRule: { select: { tipo: true, taxa: true, codigo: true } },
        },
      });
      const produto = produtoRow
        ? mapPosProduto(produtoRow as Record<string, unknown>)
        : null;
      const produtoTaxRule = produtoRow?.taxRule;

      const disponivel = produto ? await this.getDisponivel(tx, { id: produtoRow!.id }) : 0;

      items.push({
        id: row.id.toString(),
        tipo: "produto",
        produtoId: row.produtoId.toString(),
        servicoId: null,
        loteId: row.loteId ? row.loteId.toString() : null,
        nome: row.descricao,
        quantidade: Number(row.quantidade),
        precoUnit: Number(row.precoUnit),
        baseCalculo: Number(row.baseCalculo),
        valorIva: Number(row.valorIva),
        total: Number(row.total),
        ivaPercentual: Number(row.iva),
        taxRule: produtoTaxRule
          ? {
              tipo: produtoTaxRule.tipo,
              taxa: Number(produtoTaxRule.taxa),
              codigo: produtoTaxRule.codigo,
            }
          : null,
        requiresPrescription: produto?.requiresPrescription ?? false,
        estoqueAtual: disponivel,
        estoqueDisponivel: disponivel,
        tipoServicoClinico: null,
      });
    }

    return {
      id: fatura.id.toString(),
      numero: fatura.numero,
      estado: fatura.estado,
      idempotencyKey: fatura.idempotencyKey,
      subtotal: Number(fatura.subtotal),
      desconto: Number(fatura.desconto),
      ivaTotal: Number(fatura.ivaTotal),
      total: Number(fatura.total),
      items,
    };
  }

  async syncDraftCatalogState(tx: any, faturaId: bigint) {
    const items = await tx.faturaItem.findMany({
      where: { faturaId },
      select: {
        id: true,
        produtoId: true,
        servicoId: true,
        quantidade: true,
        precoUnit: true,
        descricao: true,
        baseCalculo: true,
        valorIva: true,
        total: true,
      },
    });

    let changed = false;

    for (const item of items) {
      const quantidade = Number(item.quantidade);

      if (item.servicoId) {
        const servico = await this.loadServicoForUpdate(tx, item.servicoId.toString());
        const preco = resolveServicoPrecoFromRow(servico);
        const taxRuleSnapshot = this.taxRuleSnapshotFromServico(servico);
        const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
          quantidade,
          precoUnitario: preco,
          taxRule: taxRuleSnapshot,
          descricao: servico.nome,
        });

        if (
          Number(item.precoUnit) !== preco ||
          item.descricao !== servico.nome ||
          Number(item.baseCalculo ?? 0) !== fiscalCalc.baseCalculo ||
          Number(item.valorIva ?? 0) !== fiscalCalc.valorIva ||
          Number(item.total ?? 0) !== fiscalCalc.totalItem
        ) {
          changed = true;
          await tx.faturaItem.update({
            where: { id: item.id },
            data: {
              descricao: servico.nome,
              precoUnit: preco,
              baseCalculo: fiscalCalc.baseCalculo,
              valorIva: fiscalCalc.valorIva,
              total: fiscalCalc.totalItem,
              iva: fiscalCalc.taxaAplicadaPercentual,
              taxaAplicada: fiscalCalc.taxaAplicadaPercentual,
              tipoRegraFiscalSnapshot: fiscalCalc.tipoRegraFiscal,
              codigoRegraFiscal: fiscalCalc.codigoRegraFiscal,
            },
          });
        }
        continue;
      }

      if (!item.produtoId) {
        continue;
      }

      const produto = await this.loadProdutoForUpdate(tx, item.produtoId.toString());
      const preco = resolveProdutoPrecoVendaFromRow(produto);
      const taxRuleSnapshot = await this.loadTaxRuleSnapshot(tx, produto);
      const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
        quantidade,
        precoUnitario: preco,
        taxRule: taxRuleSnapshot,
        descricao: produto.nome,
      });

        if (
          Number(item.precoUnit) !== preco ||
          item.descricao !== produto.nome ||
          Number(item.baseCalculo ?? 0) !== fiscalCalc.baseCalculo ||
          Number(item.valorIva ?? 0) !== fiscalCalc.valorIva ||
          Number(item.total ?? 0) !== fiscalCalc.totalItem
        ) {
        changed = true;
        await tx.faturaItem.update({
          where: { id: item.id },
          data: {
            descricao: produto.nome,
            precoUnit: preco,
            baseCalculo: fiscalCalc.baseCalculo,
            valorIva: fiscalCalc.valorIva,
            total: fiscalCalc.totalItem,
            iva: fiscalCalc.taxaAplicadaPercentual,
            taxaAplicada: fiscalCalc.taxaAplicadaPercentual,
            tipoRegraFiscalSnapshot: fiscalCalc.tipoRegraFiscal,
            codigoRegraFiscal: fiscalCalc.codigoRegraFiscal,
          },
        });
      }
    }

    if (changed) {
      await this.recalculateFaturaTotals(tx, faturaId);
    }
  }
}

export const draftCartService = new DraftCartService();
