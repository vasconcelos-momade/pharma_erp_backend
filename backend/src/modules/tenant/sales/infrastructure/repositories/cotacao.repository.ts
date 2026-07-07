import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ComplianceAuditService } from "../../../../../shared/services/compliance-audit.service";
import { parseDateRange } from "../../../regulatory/application/use-cases/regulatory.helpers";
import { flattenProdutoForApi } from "../../../products/domain/produto-presenter";
import type {
  AddCotacaoItemDTO,
  CreateCotacaoDTO,
  UpdateCotacaoDTO,
  UpdateCotacaoItemDTO,
} from "../../application/dto/cotacao.dto";
import {
  buildCotacaoItemApi,
  buildCotacaoTotals,
  computeCotacaoItemSnapshot,
} from "../../application/helpers/cotacao-calculator";

type CotacaoSearchFilters = {
  query?: string;
  estado?: "PENDENTE" | "APROVADA" | "REJEITADA" | "EXPIRADA";
  clienteId?: bigint;
  userId?: bigint;
  validadeFrom?: string;
  validadeTo?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: "createdAt" | "validade" | "numero" | "total" | "clienteNome";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

type PrismaTx = any;

const COTACAO_ITEM_INCLUDE = {
  produto: {
    select: {
      id: true,
      nomeComercial: true,
      barcode: true,
      taxRule: {
        select: {
          codigo: true,
          tipo: true,
          taxa: true,
        },
      },
    },
  },
  servico: {
    select: {
      id: true,
      nome: true,
      preco: true,
      taxRule: {
        select: {
          codigo: true,
          tipo: true,
          taxa: true,
        },
      },
    },
  },
} as const;

function serializeCotacaoItem(row: any) {
  return buildCotacaoItemApi(row);
}

function serializeCotacao(row: any) {
  const items = row.items?.map(serializeCotacaoItem) ?? [];
  const totals = buildCotacaoTotals(items, Number(row.desconto ?? 0), {
    subtotal: row.subtotal != null ? Number(row.subtotal) : undefined,
    ivaTotal: row.ivaTotal != null ? Number(row.ivaTotal) : undefined,
    total: row.total != null ? Number(row.total) : undefined,
  });

  return {
    id: row.id.toString(),
    numero: row.numero,
    cliente: row.clienteNome ?? row.cliente ?? "",
    clienteId: row.clienteId?.toString() ?? null,
    userId: row.userId.toString(),
    subtotal: totals.subtotal,
    desconto: Number(row.desconto ?? 0),
    ivaTotal: totals.ivaTotal,
    total: totals.total,
    moeda: row.moeda,
    estado: row.estado,
    validade: row.validade.toISOString(),
    observacoes: row.observacoes ?? null,
    aprovadoPorId: row.aprovadoPorId?.toString() ?? null,
    aprovadoEm: row.aprovadoEm?.toISOString?.() ?? null,
    deletedAt: row.deletedAt?.toISOString?.() ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    clienteCadastrado: row.clienteCadastrado
      ? {
          id: row.clienteCadastrado.id.toString(),
          nome: row.clienteCadastrado.nome,
          telefone: row.clienteCadastrado.telefone ?? null,
          nuit: row.clienteCadastrado.nuit ?? null,
        }
      : null,
    user: row.user
      ? {
          id: row.user.id.toString(),
          name: row.user.name,
          role: row.user.role,
        }
      : null,
    aprovadoPor: row.aprovadoPor
      ? {
          id: row.aprovadoPor.id.toString(),
          name: row.aprovadoPor.name,
          role: row.aprovadoPor.role,
        }
      : null,
    itemCount: row._count?.items ?? items.length,
    items,
    canEdit: row.estado === "PENDENTE" && !row.deletedAt,
  };
}

const COTACAO_INCLUDE = {
  clienteCadastrado: {
    select: { id: true, nome: true, telefone: true, nuit: true },
  },
  user: { select: { id: true, name: true, role: true } },
  aprovadoPor: { select: { id: true, name: true, role: true } },
  items: {
    include: COTACAO_ITEM_INCLUDE,
    orderBy: { id: "asc" as const },
  },
  _count: { select: { items: true } },
} as const;

export class CotacaoRepository {
  private audit = new ComplianceAuditService();

  private get prisma() {
    return getPrisma() as any;
  }

  private async expireOverdueQuotes(tx?: PrismaTx) {
    const prisma = tx ?? this.prisma;
    await prisma.cotacao.updateMany({
      where: {
        deletedAt: null,
        estado: "PENDENTE",
        validade: { lt: new Date() },
      },
      data: {
        estado: "EXPIRADA",
      },
    });
  }

  private buildNumeroCotacao() {
    return `COT-${Date.now()}`;
  }

  private async assertClienteExists(tx: PrismaTx, clienteId: bigint) {
    const cliente = await tx.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      select: { id: true, nome: true, telefone: true, nuit: true },
    });

    if (!cliente) {
      throw new Error("Cliente não encontrado");
    }

    return cliente;
  }

  private async loadProdutoSnapshot(tx: PrismaTx, produtoId: bigint) {
    const produto = await tx.produto.findFirst({
      where: { id: produtoId, deletedAt: null, ativo: true },
      include: {
        taxRule: {
          select: {
            codigo: true,
            tipo: true,
            taxa: true,
          },
        },
        stockBalance: {
          select: {
            quantidadeDisponivel: true,
          },
        },
        regulacao: true,
        lotes: {
          where: {
            ativo: true,
            deletedAt: null,
            stockBalance: { quantidadeDisponivel: { gt: 0 } },
          },
          orderBy: { dataValidade: "asc" },
          take: 3,
          select: {
            id: true,
            numeroLote: true,
            dataValidade: true,
            precoVenda: true,
            quantidadeQuarentena: true,
            stockBalance: { select: { quantidadeDisponivel: true } },
          },
        },
      },
    });

    if (!produto) {
      throw new Error(`Produto ${produtoId.toString()} não encontrado`);
    }

    const flat = flattenProdutoForApi(produto as Record<string, unknown>);
    return {
      id: produto.id,
      nome: produto.nomeComercial,
      barcode: produto.barcode ?? null,
      precoVenda: Number(flat.precoVenda ?? 0),
      taxRule: produto.taxRule,
    };
  }

  private async loadServicoSnapshot(tx: PrismaTx, servicoId: bigint) {
    const servico = await tx.servico.findFirst({
      where: { id: servicoId, ativo: true },
      include: {
        taxRule: {
          select: {
            codigo: true,
            tipo: true,
            taxa: true,
          },
        },
      },
    });

    if (!servico) {
      throw new Error(`Serviço ${servicoId.toString()} não encontrado`);
    }

    return servico;
  }

  private assertCanMutate(row: any, action: string) {
    if (row.deletedAt) {
      throw new Error("Cotação não encontrada");
    }

    if (row.estado !== "PENDENTE") {
      throw new Error(`Não é possível ${action} uma cotação com estado ${row.estado}`);
    }
  }

  private async resolveClienteSnapshot(
    tx: PrismaTx,
    data: { cliente: string; clienteId?: string | null },
  ) {
    const nome = data.cliente.trim();
    if (!nome) {
      throw new Error("Informe o nome do cliente");
    }

    if (data.clienteId) {
      const cliente = await this.assertClienteExists(tx, BigInt(data.clienteId));
      return {
        clienteNome: cliente.nome ?? nome,
        clienteId: cliente.id,
      };
    }

    return {
      clienteNome: nome,
      clienteId: null,
    };
  }

  private async recalculateAndPersistTotals(tx: PrismaTx, cotacaoId: bigint) {
    const row = await tx.cotacao.findUnique({
      where: { id: cotacaoId },
      include: {
        items: { include: COTACAO_ITEM_INCLUDE, orderBy: { id: "asc" } },
      },
    });
    if (!row) {
      throw new Error("Cotação não encontrada");
    }

    const items = row.items.map(serializeCotacaoItem);
    const totals = buildCotacaoTotals(items, Number(row.desconto ?? 0));

    await tx.cotacao.update({
      where: { id: cotacaoId },
      data: {
        subtotal: totals.subtotal,
        ivaTotal: totals.ivaTotal,
        total: totals.total,
      },
    });

    return totals;
  }

  private async buildItemSnapshotFromInput(
    tx: PrismaTx,
    input: AddCotacaoItemDTO | (UpdateCotacaoItemDTO & { produtoId?: string; servicoId?: string }),
    existing?: any,
  ) {
    const quantidade = Number(
      input.quantidade ?? existing?.quantidade ?? 1,
    );
    let precoUnit = input.precoUnit != null ? Number(input.precoUnit) : undefined;
    let descricao = input.descricao?.trim();
    let taxRule: any = null;

    if (input.produtoId || existing?.produtoId) {
      const produto = await this.loadProdutoSnapshot(
        tx,
        BigInt(input.produtoId ?? existing.produtoId),
      );
      precoUnit = precoUnit ?? produto.precoVenda;
      descricao = descricao ?? produto.nome;
      taxRule = produto.taxRule;
    } else if (input.servicoId || existing?.servicoId) {
      const servico = await this.loadServicoSnapshot(
        tx,
        BigInt(input.servicoId ?? existing.servicoId),
      );
      precoUnit = precoUnit ?? Number(servico.preco);
      descricao = descricao ?? servico.nome;
      taxRule = servico.taxRule;
    }

    if (!Number.isFinite(precoUnit) || (precoUnit ?? 0) <= 0) {
      throw new Error("Preço unitário inválido");
    }

    return computeCotacaoItemSnapshot({
      quantidade,
      precoUnit: precoUnit!,
      desconto: input.desconto,
      descontoPercent: input.descontoPercent,
      descricao,
      taxRule,
    });
  }

  async create(data: CreateCotacaoDTO, userId: bigint) {
    await this.expireOverdueQuotes();

    const created = await this.prisma.$transaction(async (tx: PrismaTx) => {
      const clienteSnapshot = await this.resolveClienteSnapshot(tx, {
        cliente: data.cliente,
        clienteId: data.clienteId,
      });

      const cotacao = await tx.cotacao.create({
        data: {
          numero: this.buildNumeroCotacao(),
          clienteNome: clienteSnapshot.clienteNome,
          clienteId: clienteSnapshot.clienteId,
          userId,
          desconto: data.desconto ?? 0,
          validade: data.validade,
          observacoes: data.observacoes ?? null,
          estado: "PENDENTE",
          subtotal: 0,
          ivaTotal: 0,
          total: 0,
        },
      });

      if (data.items?.length) {
        for (const item of data.items) {
          await this.addItemInternal(tx, cotacao.id, item, userId, false);
        }
      }

      const withRelations = await tx.cotacao.findUnique({
        where: { id: cotacao.id },
        include: COTACAO_INCLUDE,
      });

      await this.audit.createImmutableLog(
        {
          userId,
          action: "CREATE",
          entity: "Cotacao",
          entityId: cotacao.id,
          after: serializeCotacao(withRelations),
        },
        tx,
      );

      return withRelations;
    });

    return serializeCotacao(created);
  }

  private async addItemInternal(
    tx: PrismaTx,
    cotacaoId: bigint,
    data: AddCotacaoItemDTO,
    userId: bigint,
    audit = true,
  ) {
    const cotacao = await tx.cotacao.findFirst({
      where: { id: cotacaoId, deletedAt: null },
      include: { items: true },
    });
    if (!cotacao) {
      throw new Error("Cotação não encontrada");
    }
    this.assertCanMutate(cotacao, "adicionar itens a");

    const existing = cotacao.items.find((item: any) =>
      data.produtoId
        ? item.produtoId?.toString() === data.produtoId
        : item.servicoId?.toString() === data.servicoId,
    );

    if (existing) {
      const snapshot = await this.buildItemSnapshotFromInput(tx, {
        ...data,
        quantidade: Number(existing.quantidade) + Number(data.quantidade ?? 1),
      }, existing);

      await tx.cotacaoItem.update({
        where: { id: existing.id },
        data: {
          descricao: snapshot.descricao,
          quantidade: snapshot.quantidade,
          precoUnit: snapshot.precoUnit,
          desconto: snapshot.desconto,
          iva: snapshot.iva,
          valorIva: snapshot.valorIva,
          subtotal: snapshot.subtotal,
          total: snapshot.total,
        },
      });
    } else {
      const snapshot = await this.buildItemSnapshotFromInput(tx, {
        ...data,
        quantidade: data.quantidade ?? 1,
      });

      await tx.cotacaoItem.create({
        data: {
          cotacaoId,
          produtoId: data.produtoId ? BigInt(data.produtoId) : null,
          servicoId: data.servicoId ? BigInt(data.servicoId) : null,
          descricao: snapshot.descricao,
          quantidade: snapshot.quantidade,
          precoUnit: snapshot.precoUnit,
          desconto: snapshot.desconto,
          iva: snapshot.iva,
          valorIva: snapshot.valorIva,
          subtotal: snapshot.subtotal,
          total: snapshot.total,
        },
      });
    }

    await this.recalculateAndPersistTotals(tx, cotacaoId);
    await tx.cotacao.update({
      where: { id: cotacaoId },
      data: { version: { increment: 1 } },
    });

    const refreshed = await tx.cotacao.findUnique({
      where: { id: cotacaoId },
      include: COTACAO_INCLUDE,
    });

    if (audit) {
      await this.audit.createImmutableLog(
        {
          userId,
          action: "ADD_ITEM",
          entity: "Cotacao",
          entityId: cotacaoId,
          after: serializeCotacao(refreshed),
        },
        tx,
      );
    }

    return serializeCotacao(refreshed);
  }

  async addItem(cotacaoId: bigint, data: AddCotacaoItemDTO, userId: bigint) {
    await this.expireOverdueQuotes();
    return this.prisma.$transaction((tx: PrismaTx) =>
      this.addItemInternal(tx, cotacaoId, data, userId),
    );
  }

  async updateItem(
    cotacaoId: bigint,
    itemId: bigint,
    data: UpdateCotacaoItemDTO,
    userId: bigint,
  ) {
    await this.expireOverdueQuotes();

    return this.prisma.$transaction(async (tx: PrismaTx) => {
      const cotacao = await tx.cotacao.findFirst({
        where: { id: cotacaoId, deletedAt: null },
      });
      if (!cotacao) {
        throw new Error("Cotação não encontrada");
      }
      this.assertCanMutate(cotacao, "editar itens de");

      const existing = await tx.cotacaoItem.findFirst({
        where: { id: itemId, cotacaoId },
        include: COTACAO_ITEM_INCLUDE,
      });
      if (!existing) {
        throw new Error("Item não encontrado");
      }

      const snapshot = await this.buildItemSnapshotFromInput(tx, data, existing);

      await tx.cotacaoItem.update({
        where: { id: itemId },
        data: {
          descricao: snapshot.descricao,
          quantidade: snapshot.quantidade,
          precoUnit: snapshot.precoUnit,
          desconto: snapshot.desconto,
          iva: snapshot.iva,
          valorIva: snapshot.valorIva,
          subtotal: snapshot.subtotal,
          total: snapshot.total,
        },
      });

      await this.recalculateAndPersistTotals(tx, cotacaoId);
      await tx.cotacao.update({
        where: { id: cotacaoId },
        data: { version: { increment: 1 } },
      });

      const refreshed = await tx.cotacao.findUnique({
        where: { id: cotacaoId },
        include: COTACAO_INCLUDE,
      });

      await this.audit.createImmutableLog(
        {
          userId,
          action: "UPDATE_ITEM",
          entity: "Cotacao",
          entityId: cotacaoId,
          after: serializeCotacao(refreshed),
        },
        tx,
      );

      return serializeCotacao(refreshed);
    });
  }

  async removeItem(cotacaoId: bigint, itemId: bigint, userId: bigint) {
    await this.expireOverdueQuotes();

    return this.prisma.$transaction(async (tx: PrismaTx) => {
      const cotacao = await tx.cotacao.findFirst({
        where: { id: cotacaoId, deletedAt: null },
      });
      if (!cotacao) {
        throw new Error("Cotação não encontrada");
      }
      this.assertCanMutate(cotacao, "remover itens de");

      const existing = await tx.cotacaoItem.findFirst({
        where: { id: itemId, cotacaoId },
      });
      if (!existing) {
        throw new Error("Item não encontrado");
      }

      await tx.cotacaoItem.delete({ where: { id: itemId } });
      await this.recalculateAndPersistTotals(tx, cotacaoId);
      await tx.cotacao.update({
        where: { id: cotacaoId },
        data: { version: { increment: 1 } },
      });

      const refreshed = await tx.cotacao.findUnique({
        where: { id: cotacaoId },
        include: COTACAO_INCLUDE,
      });

      await this.audit.createImmutableLog(
        {
          userId,
          action: "REMOVE_ITEM",
          entity: "Cotacao",
          entityId: cotacaoId,
          after: serializeCotacao(refreshed),
        },
        tx,
      );

      return serializeCotacao(refreshed);
    });
  }

  async search(filters: CotacaoSearchFilters = {}) {
    await this.expireOverdueQuotes();

    const query = (filters.query ?? "").trim() || undefined;
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const sortBy = filters.sortBy ?? "createdAt";
    const sortOrder = filters.sortOrder === "asc" ? "asc" : "desc";
    const validadeRange = parseDateRange(filters.validadeFrom, filters.validadeTo);
    const createdRange = parseDateRange(filters.createdFrom, filters.createdTo);

    const where: any = {
      deletedAt: null,
      ...(filters.estado ? { estado: filters.estado } : {}),
      ...(filters.clienteId ? { clienteId: filters.clienteId } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(validadeRange.from || validadeRange.to
        ? {
            validade: {
              ...(validadeRange.from ? { gte: validadeRange.from } : {}),
              ...(validadeRange.to ? { lte: validadeRange.to } : {}),
            },
          }
        : {}),
      ...(createdRange.from || createdRange.to
        ? {
            createdAt: {
              ...(createdRange.from ? { gte: createdRange.from } : {}),
              ...(createdRange.to ? { lte: createdRange.to } : {}),
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { numero: { contains: query } },
              { observacoes: { contains: query } },
              { clienteNome: { contains: query } },
              { clienteCadastrado: { nome: { contains: query } } },
              { items: { some: { produto: { nomeComercial: { contains: query } } } } },
              { items: { some: { servico: { nome: { contains: query } } } } },
            ],
          }
        : {}),
    };

    const orderBy =
      sortBy === "validade"
        ? [{ validade: sortOrder }, { id: sortOrder }]
        : sortBy === "numero"
          ? [{ numero: sortOrder }, { id: sortOrder }]
          : sortBy === "clienteNome"
            ? [{ clienteNome: sortOrder }, { id: sortOrder }]
            : sortBy === "total"
              ? [{ total: sortOrder }, { id: sortOrder }]
              : [{ createdAt: sortOrder }, { id: sortOrder }];

    const [totalCount, rows] = await this.prisma.$transaction([
      this.prisma.cotacao.count({ where }),
      this.prisma.cotacao.findMany({
        where,
        include: {
          clienteCadastrado: {
            select: { id: true, nome: true, telefone: true, nuit: true },
          },
          user: { select: { id: true, name: true, role: true } },
          aprovadoPor: { select: { id: true, name: true, role: true } },
          _count: { select: { items: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, pageSize).map(serializeCotacao),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }

  async getById(id: bigint) {
    await this.expireOverdueQuotes();

    const row = await this.prisma.cotacao.findFirst({
      where: { id, deletedAt: null },
      include: COTACAO_INCLUDE,
    });

    if (!row) {
      throw new Error("Cotação não encontrada");
    }

    return serializeCotacao(row);
  }

  async update(id: bigint, data: UpdateCotacaoDTO, userId: bigint) {
    await this.expireOverdueQuotes();

    const existing = await this.prisma.cotacao.findFirst({
      where: { id, deletedAt: null },
      include: COTACAO_INCLUDE,
    });

    if (!existing) {
      throw new Error("Cotação não encontrada");
    }

    this.assertCanMutate(existing, "editar");

    const updated = await this.prisma.$transaction(async (tx: PrismaTx) => {
      const updateData: Record<string, unknown> = {
        ...(data.validade ? { validade: data.validade } : {}),
        ...(data.observacoes !== undefined
          ? { observacoes: data.observacoes ?? null }
          : {}),
        ...(data.desconto !== undefined ? { desconto: data.desconto } : {}),
        version: { increment: 1 },
      };

      if (data.cliente !== undefined || data.clienteId !== undefined) {
        const snapshot = await this.resolveClienteSnapshot(tx, {
          cliente: data.cliente ?? existing.clienteNome,
          clienteId:
            data.clienteId !== undefined
              ? data.clienteId
              : existing.clienteId?.toString() ?? null,
        });
        updateData.clienteNome = snapshot.clienteNome;
        updateData.clienteId = snapshot.clienteId;
      }

      await tx.cotacao.update({
        where: { id, version: existing.version },
        data: updateData,
      });

      if (data.desconto !== undefined) {
        await this.recalculateAndPersistTotals(tx, id);
      }

      const row = await tx.cotacao.findUnique({
        where: { id },
        include: COTACAO_INCLUDE,
      });

      await this.audit.createImmutableLog(
        {
          userId,
          action: "UPDATE",
          entity: "Cotacao",
          entityId: row!.id,
          before: serializeCotacao(existing),
          after: serializeCotacao(row),
        },
        tx,
      );

      return row;
    });

    return serializeCotacao(updated);
  }

  async softDelete(id: bigint, userId: bigint) {
    await this.expireOverdueQuotes();

    const existing = await this.prisma.cotacao.findFirst({
      where: { id, deletedAt: null },
      include: COTACAO_INCLUDE,
    });

    if (!existing) {
      throw new Error("Cotação não encontrada");
    }

    if (existing.estado === "APROVADA") {
      throw new Error("Não é possível remover uma cotação aprovada");
    }

    await this.prisma.$transaction(async (tx: PrismaTx) => {
      await tx.cotacao.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await this.audit.createImmutableLog(
        {
          userId,
          action: "DELETE",
          entity: "Cotacao",
          entityId: id,
          before: serializeCotacao(existing),
        },
        tx,
      );
    });
  }

  async mutateStatus(
    id: bigint,
    nextStatus: "APROVADA" | "REJEITADA" | "EXPIRADA",
    userId: bigint,
    observacoes?: string,
  ) {
    await this.expireOverdueQuotes();

    const existing = await this.prisma.cotacao.findFirst({
      where: { id, deletedAt: null },
      include: COTACAO_INCLUDE,
    });

    if (!existing) {
      throw new Error("Cotação não encontrada");
    }

    this.assertCanMutate(existing, "alterar o estado de");

    const updated = await this.prisma.$transaction(async (tx: PrismaTx) => {
      const row = await tx.cotacao.update({
        where: { id, version: existing.version },
        data: {
          estado: nextStatus,
          ...(nextStatus === "APROVADA"
            ? { aprovadoPorId: userId, aprovadoEm: new Date() }
            : {}),
          observacoes:
            observacoes && observacoes.trim().length > 0
              ? [existing.observacoes, observacoes.trim()].filter(Boolean).join("\n\n")
              : existing.observacoes,
          version: { increment: 1 },
        },
        include: COTACAO_INCLUDE,
      });

      await this.audit.createImmutableLog(
        {
          userId,
          action: nextStatus === "APROVADA" ? "APPROVE" : nextStatus,
          entity: "Cotacao",
          entityId: row.id,
          before: serializeCotacao(existing),
          after: serializeCotacao(row),
        },
        tx,
      );

      return row;
    });

    return serializeCotacao(updated);
  }

  async listAuditLogs(cotacaoId: bigint, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const where = { entity: "Cotacao", entityId: cotacaoId };

    const [totalCount, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (safePage - 1) * safeSize,
        take: safeSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, safeSize).map((row: any) => ({
        id: row.id.toString(),
        action: row.action,
        entity: row.entity,
        entityId: row.entityId?.toString() ?? null,
        before: row.before ?? null,
        after: row.after ?? null,
        createdAt: row.createdAt.toISOString(),
        user: row.user
          ? {
              id: row.user.id.toString(),
              name: row.user.name,
              role: row.user.role,
            }
          : null,
      })),
      page: safePage,
      pageSize: safeSize,
      hasMore: rows.length > safeSize,
      totalCount,
    };
  }
}
