import {
  FiscalCalculatorUtil,
  type TaxRuleSnapshot,
} from "../../../../../shared/utils/fiscal-calculator.util";
import type {
  DraftCartCheckoutHints,
  DraftCartItemInput,
  DraftCartItemView,
  DraftCartMutationContext,
  DraftCartProdutoItemInput,
  DraftCartServicoItemInput,
  DraftCartView,
} from "./draft-cart.types";
import { isDraftCartServicoItem } from "./draft-cart.types";
import { mapPosProduto, produtoPosSelect } from "../../../products/domain/produto-presenter";
import { getQuantidadeDisponivel, syncStockBalanceCache } from "../../../stock/domain/produto-stock.service";
import { selectFefoLoteForSale } from "../../../stock/domain/fefo-lote.service";
import {
  getPrimaryLoteIdForItem,
  setDraftItemLoteAllocation,
  syncDraftItemLoteQuantity,
} from "../../../sales/domain/fatura-item-lote.service";
import { resolveVendaClienteId } from "../../../clients/domain/default-cliente";

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

  async resolveClienteId(tx: any, clienteId?: string | null): Promise<bigint> {
    return resolveVendaClienteId(tx, clienteId);
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

  async buildFreshCartKey(tx: any, userId: string): Promise<string> {
    const sessao = await tx.caixaSessao.findFirst({
      where: {
        userId: BigInt(userId),
        status: "ABERTA",
        deletedAt: null,
      },
      orderBy: { openedAt: "desc" },
      select: { id: true },
    });
    const scope = sessao?.id?.toString() ?? "0";
    return `pdv-${userId}-${scope}-${Date.now()}`;
  }

  async isCartKeyConsumed(
    tx: any,
    cartKey: string,
    terminalId: bigint,
  ): Promise<boolean> {
    const finalized = await tx.fatura.findFirst({
      where: {
        idempotencyKey: `TERM-${terminalId}:${cartKey}`,
        estado: { not: "RASCUNHO" },
      },
      select: { id: true },
    });
    return finalized != null;
  }

  async migrateDraftCartKey(
    tx: any,
    draftFaturaId: bigint,
    oldKey: string,
    newKey: string,
  ): Promise<void> {
    await tx.fatura.update({
      where: { id: draftFaturaId },
      data: { idempotencyKey: newKey },
    });

    const reservas = await tx.estoqueReserva.findMany({
      where: { faturaId: draftFaturaId },
      select: { id: true, idempotencyKey: true },
    });

    const oldPrefix = `RES-${oldKey}-`;
    for (const reserva of reservas) {
      const currentKey = reserva.idempotencyKey as string | null;
      if (!currentKey?.startsWith(oldPrefix)) {
        continue;
      }
      const suffix = currentKey.slice(oldPrefix.length);
      await tx.estoqueReserva.update({
        where: { id: reserva.id },
        data: { idempotencyKey: `RES-${newKey}-${suffix}` },
      });
    }
  }

  /** Roda chave de carrinho já consumida por venda anterior. */
  async ensureActiveCartKey(
    tx: any,
    ctx: DraftCartMutationContext,
  ): Promise<string> {
    const terminalId = await this.resolveTerminalId(tx, ctx.terminalId);
    if (!terminalId || !ctx.idempotencyKey) {
      return ctx.idempotencyKey;
    }

    const consumed = await this.isCartKeyConsumed(tx, ctx.idempotencyKey, terminalId);
    if (!consumed) {
      return ctx.idempotencyKey;
    }

    const draft = await tx.fatura.findUnique({
      where: { idempotencyKey: ctx.idempotencyKey },
      select: { id: true, estado: true },
    });

    const newKey = await this.buildFreshCartKey(tx, ctx.userId);
    if (draft?.estado === "RASCUNHO") {
      await this.migrateDraftCartKey(tx, draft.id, ctx.idempotencyKey, newKey);
    }

    return newKey;
  }

  async resolveOrCreateFatura(tx: any, ctx: DraftCartMutationContext) {
    await this.assertCaixaAberta(tx, ctx.userId);

    const idempotencyKey = await this.ensureActiveCartKey(tx, ctx);

    const existing = await tx.fatura.findUnique({
      where: { idempotencyKey },
      select: { id: true, estado: true },
    });

    if (existing) {
      if (existing.estado !== "RASCUNHO") {
        throw new Error("A fatura associada ao carrinho não está em rascunho.");
      }
      return { id: existing.id, idempotencyKey };
    }

    const clienteId = await this.resolveClienteId(tx, ctx.clienteId);
    const terminalId = await this.resolveTerminalId(tx, ctx.terminalId);
    const now = Date.now();

    const created = await tx.fatura.create({
      data: {
        numero: `DRAFT-${now}`,
        serie: new Date().getFullYear().toString(),
        clienteId,
        terminalId,
        userId: BigInt(ctx.userId),
        idempotencyKey,
        subtotal: 0,
        ivaTotal: 0,
        total: 0,
        estado: "RASCUNHO",
      },
      select: { id: true, idempotencyKey: true },
    });
    return created;
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
    const preco = Number(servico.preco ?? 0);
    if (!Number.isFinite(preco) || preco <= 0) {
      const nome = servico.nome?.trim() || "Serviço";
      throw new Error(
        `O serviço «${nome}» não pode ser adicionado ao carrinho: o preço deve ser superior a zero.`,
      );
    }
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

  async resolveDraftFaturaOrThrow(tx: any, ctx: DraftCartMutationContext) {
    const idempotencyKey = await this.ensureActiveCartKey(tx, ctx);
    const fatura = await tx.fatura.findUnique({
      where: { idempotencyKey },
      select: { id: true, estado: true, idempotencyKey: true },
    });
    if (!fatura || fatura.estado !== "RASCUNHO") {
      throw new Error("Carrinho rascunho não encontrado. Adicione um item primeiro.");
    }
    return fatura;
  }

  /** Resolve o rascunho activo do utilizador (chave pedida ou último com itens). */
  async resolveActiveDraftFatura(
    tx: any,
    userId: string,
    idempotencyKey?: string,
  ): Promise<{ id: bigint; idempotencyKey: string | null } | null> {
    if (idempotencyKey) {
      const keyed = await tx.fatura.findUnique({
        where: { idempotencyKey },
        select: {
          id: true,
          estado: true,
          idempotencyKey: true,
          _count: { select: { items: true } },
        },
      });
      if (keyed?.estado === "RASCUNHO" && keyed._count.items > 0) {
        return { id: keyed.id, idempotencyKey: keyed.idempotencyKey };
      }
    }

    const fallback = await tx.fatura.findFirst({
      where: {
        userId: BigInt(userId),
        estado: "RASCUNHO",
        deletedAt: null,
        items: { some: {} },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, idempotencyKey: true },
    });

    return fallback ?? null;
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
        `Stock insuficiente (disponível: ${disponivel}) para o produto ${produto.nomeComercial}`,
      );
    }

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
        quantidadeTotal: disponivel + delta,
        quantidadeReservada: delta,
        quantidadeDisponivel: disponivel - delta,
      },
    });

    await syncStockBalanceCache(tx, produto.id);
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

    await syncStockBalanceCache(tx, produtoId);
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
    const loteIdInput = item.loteId ? BigInt(item.loteId) : null;
    const { lote, precoVenda } = await selectFefoLoteForSale(
      tx,
      produto.id,
      loteIdInput,
      produto.nomeComercial,
    );

    const preco = item.precoUnit ?? precoVenda;
    if (!Number.isFinite(preco) || preco <= 0) {
      throw new Error(
        `Preço inválido para o produto ${produto.nomeComercial}. O preço unitário deve ser superior a zero.`,
      );
    }

    const taxRuleSnapshot = await this.loadTaxRuleSnapshot(tx, produto);
    const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
      quantidade: delta,
      precoUnitario: preco,
      taxRule: taxRuleSnapshot,
      descricao: produto.nomeComercial,
    });

    const loteId = lote.id;

    await this.reserveStock(tx, {
      faturaId,
      produto,
      loteId,
      delta,
      idempotencyKey: ctx.idempotencyKey,
    });

    const existingItem = await tx.faturaItem.findFirst({
      where: { faturaId, produtoId: produto.id },
      select: { id: true },
    });

    if (existingItem) {
      await tx.faturaItem.update({
        where: { id: existingItem.id },
        data: {
          quantidade: { increment: delta },
          baseCalculo: { increment: fiscalCalc.baseCalculo },
          valorIva: { increment: fiscalCalc.valorIva },
          total: { increment: fiscalCalc.totalItem },
        },
      });
      const newQty =
        Number(
          (
            await tx.faturaItem.findUnique({
              where: { id: existingItem.id },
              select: { quantidade: true },
            })
          )?.quantidade ?? delta,
        );
      await syncDraftItemLoteQuantity(tx, existingItem.id, newQty);
    } else {
      const created = await tx.faturaItem.create({
        data: {
          faturaId,
          produtoId: produto.id,
          descricao: produto.nomeComercial,
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
        select: { id: true },
      });
      await setDraftItemLoteAllocation(tx, created.id, loteId, delta);
    }
  }

  async addServicoDelta(
    tx: any,
    faturaId: bigint,
    ctx: DraftCartMutationContext,
    item: DraftCartServicoItemInput,
  ) {
    const delta = item.quantidade;
    if (!Number.isFinite(delta) || delta <= 0) {
      throw new Error("Quantidade inválida.");
    }

    const servico = await this.loadServicoForUpdate(tx, item.servicoId);
    this.assertServicoPrecoVendavel(servico);

    const preco = item.precoUnit ?? Number(servico.preco);
    if (!Number.isFinite(preco) || preco <= 0) {
      throw new Error(
        `Preço inválido para o serviço ${servico.nome}. O preço unitário deve ser superior a zero.`,
      );
    }

    const taxRuleSnapshot = this.taxRuleSnapshotFromServico(servico);
    const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
      quantidade: delta,
      precoUnitario: preco,
      taxRule: taxRuleSnapshot,
      descricao: servico.nome,
    });

    const existingItem = await tx.faturaItem.findFirst({
      where: { faturaId, servicoId: servico.id },
      select: { id: true },
    });

    if (existingItem) {
      await tx.faturaItem.update({
        where: { id: existingItem.id },
        data: {
          quantidade: { increment: delta },
          baseCalculo: { increment: fiscalCalc.baseCalculo },
          valorIva: { increment: fiscalCalc.valorIva },
          total: { increment: fiscalCalc.totalItem },
        },
      });
    } else {
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
        precoUnit: Number(faturaItem.precoUnit),
      });
    }
    const primaryLoteId = await getPrimaryLoteIdForItem(tx, faturaItem.id);
    return this.addItemDelta(tx, faturaId, ctx, {
      produtoId: faturaItem.produtoId.toString(),
      loteId: primaryLoteId?.toString(),
      quantidade: 1,
      precoUnit: Number(faturaItem.precoUnit),
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
      const loteId = await getPrimaryLoteIdForItem(tx, faturaItem.id as bigint);
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
    const preco = Number(faturaItem.precoUnit);

    if (faturaItem.servicoId) {
      const servico = await this.loadServicoForUpdate(tx, faturaItem.servicoId.toString());
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
          quantidade: newQty,
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
    const taxRuleSnapshot = await this.loadTaxRuleSnapshot(tx, produto);
    const loteId = await getPrimaryLoteIdForItem(tx, faturaItem.id as bigint);

    const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
      quantidade: newQty,
      precoUnitario: preco,
      taxRule: taxRuleSnapshot,
      descricao: produto.nomeComercial,
    });

    await tx.faturaItem.update({
      where: { id: faturaItem.id },
      data: {
        quantidade: newQty,
        baseCalculo: fiscalCalc.baseCalculo,
        valorIva: fiscalCalc.valorIva,
        total: fiscalCalc.totalItem,
        iva: fiscalCalc.taxaAplicadaPercentual,
        taxaAplicada: fiscalCalc.taxaAplicadaPercentual,
        tipoRegraFiscalSnapshot: fiscalCalc.tipoRegraFiscal,
        codigoRegraFiscal: fiscalCalc.codigoRegraFiscal,
      },
    });

    await syncDraftItemLoteQuantity(tx, faturaItem.id as bigint, newQty);

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
      const loteId = await getPrimaryLoteIdForItem(tx, faturaItem.id as bigint);

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

  buildItemIvaLabel(ivaPercentual: number): string {
    const rate = Math.round(Number(ivaPercentual) || 0);
    return rate > 0 ? `IVA (${rate}%)` : "IVA (isento)";
  }

  buildCheckoutHints(
    subtotal: number,
    ivaTotal: number,
    total: number,
    items: DraftCartItemView[],
    valorRecebido?: number | null,
  ): DraftCartCheckoutHints {
    return {
      requiresPrescription: items.some((item) => item.requiresPrescription),
      taxLabel: FiscalCalculatorUtil.buildTaxLabel(subtotal, ivaTotal, items),
      paymentPreview: FiscalCalculatorUtil.buildPaymentPreview(total, valorRecebido),
    };
  }

  emptyCartView(
    idempotencyKey: string,
    valorRecebido?: number | null,
  ): DraftCartView {
    const checkout = this.buildCheckoutHints(0, 0, 0, [], valorRecebido);
    return {
      id: "",
      numero: "",
      estado: "RASCUNHO",
      idempotencyKey,
      subtotal: 0,
      desconto: 0,
      ivaTotal: 0,
      total: 0,
      items: [],
      checkout,
    };
  }

  async buildCartView(
    tx: any,
    faturaId: bigint,
    valorRecebido?: number | null,
  ): Promise<DraftCartView> {
    const fatura = await tx.fatura.findUnique({
      where: { id: faturaId },
      include: {
        items: {
          orderBy: { id: "asc" },
          include: {
            lotesAlocacao: {
              orderBy: { ordemFefo: "asc" },
              select: { loteId: true },
            },
          },
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

        const ivaPercentual = Number(row.iva);
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
          ivaPercentual,
          ivaLabel: this.buildItemIvaLabel(ivaPercentual),
          taxRule: servico?.taxRule
            ? {
                tipo: servico.taxRule.tipo,
                taxa: Number(servico.taxRule.taxa),
                codigo: servico.taxRule.codigo,
              }
            : null,
          requiresPrescription: false,
          tipoDispensacao: null,
          requiresDoubleCheck: false,
          requiresPsychotropicBook: false,
          estoqueAtual: null,
          estoqueDisponivel: null,
          tipoServicoClinico: servico?.tipoServicoClinico ?? null,
          dosagem: null,
          forma: null,
          nomeGenerico: null,
        });
        continue;
      }

      if (!row.produtoId) {
        continue;
      }

      const produtoRow = await tx.produto.findUnique({
        where: { id: row.produtoId },
        select: produtoPosSelect,
      });
      const produto = produtoRow
        ? mapPosProduto(produtoRow as Record<string, unknown>)
        : null;

      const disponivel = produto ? await this.getDisponivel(tx, { id: produtoRow!.id }) : 0;

      const ivaPercentual = Number(row.iva);
      items.push({
        id: row.id.toString(),
        tipo: "produto",
        produtoId: row.produtoId.toString(),
        servicoId: null,
        loteId: row.lotesAlocacao?.[0]?.loteId?.toString() ?? null,
        nome: row.descricao,
        quantidade: Number(row.quantidade),
        precoUnit: Number(row.precoUnit),
        baseCalculo: Number(row.baseCalculo),
        valorIva: Number(row.valorIva),
        total: Number(row.total),
        ivaPercentual,
        ivaLabel: this.buildItemIvaLabel(ivaPercentual),
        taxRule: produto?.taxRule
          ? {
              tipo: produto.taxRule.tipo,
              taxa: Number(produto.taxRule.taxa),
              codigo: produto.taxRule.codigo,
            }
          : null,
        requiresPrescription: produto?.requiresPrescription ?? false,
        tipoDispensacao: produto?.tipoDispensacao ?? null,
        requiresDoubleCheck: produto?.requiresDoubleCheck ?? false,
        requiresPsychotropicBook: produto?.requiresPsychotropicBook ?? false,
        estoqueAtual: disponivel,
        estoqueDisponivel: disponivel,
        tipoServicoClinico: null,
        dosagem:
          typeof produto?.dosagem === "string" ? produto.dosagem : null,
        forma: typeof produto?.forma === "string" ? produto.forma : null,
        nomeGenerico:
          typeof produto?.nomeGenerico === "string"
            ? produto.nomeGenerico
            : null,
      });
    }

    const subtotal = Number(fatura.subtotal);
    const ivaTotal = Number(fatura.ivaTotal);
    const total = Number(fatura.total);

    return {
      id: fatura.id.toString(),
      numero: fatura.numero,
      estado: fatura.estado,
      idempotencyKey: fatura.idempotencyKey,
      subtotal,
      desconto: Number(fatura.desconto),
      ivaTotal,
      total,
      items,
      checkout: this.buildCheckoutHints(subtotal, ivaTotal, total, items, valorRecebido),
    };
  }

  async resolveCheckoutItemsFromDraft(
    tx: any,
    idempotencyKey: string,
    userId: string,
  ) {
    await this.assertCaixaAberta(tx, userId);

    const draftFatura = await tx.fatura.findFirst({
      where: {
        idempotencyKey,
        estado: "RASCUNHO",
        userId: BigInt(userId),
      },
      include: {
        items: {
          orderBy: { id: "asc" },
        },
      },
    });

    if (!draftFatura || draftFatura.items.length === 0) {
      throw new Error(
        "Carrinho vazio ou não encontrado. Adicione itens antes de finalizar.",
      );
    }

    return draftFatura.items.map((row: any) => ({
      tipo: row.servicoId ? ("servico" as const) : ("produto" as const),
      produtoId: row.produtoId ? row.produtoId.toString() : undefined,
      servicoId: row.servicoId ? row.servicoId.toString() : undefined,
      quantidade: Number(row.quantidade),
      precoUnit: Number(row.precoUnit),
    }));
  }
}

export const draftCartService = new DraftCartService();
