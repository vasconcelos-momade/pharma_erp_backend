import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { FiscalCalculatorUtil } from "../../../../../shared/utils/fiscal-calculator.util";
import { ComplianceAuditService } from "../../../../../shared/services/compliance-audit.service";
import { parseDateRange } from "../../../regulatory/application/use-cases/regulatory.helpers";
import { flattenProdutoForApi } from "../../../products/domain/produto-presenter";
import type {
  CreateCotacaoDTO,
  UpdateCotacaoDTO,
} from "../../application/dto/cotacao.dto";

type CotacaoSearchFilters = {
  query?: string;
  estado?: "PENDENTE" | "APROVADA" | "REJEITADA" | "EXPIRADA";
  clienteId?: bigint;
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

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function serializeCotacaoItem(row: any) {
  return {
    id: row.id.toString(),
    cotacaoId: row.cotacaoId.toString(),
    produtoId: row.produtoId?.toString() ?? null,
    servicoId: row.servicoId?.toString() ?? null,
    descricao: row.descricao,
    quantidade: Number(row.quantidade),
    precoUnit: Number(row.precoUnit),
    baseCalculo: Number(row.baseCalculo),
    iva: Number(row.iva),
    valorIva: Number(row.valorIva),
    taxaAplicada: Number(row.taxaAplicada),
    tipoRegraFiscalSnapshot: row.tipoRegraFiscalSnapshot ?? null,
    codigoRegraFiscal: row.codigoRegraFiscal ?? null,
    motivoIsencao: row.motivoIsencao ?? null,
    total: Number(row.total),
    produto: row.produto
      ? {
          id: row.produto.id.toString(),
          nome: row.produto.nome,
          barcode: row.produto.barcode ?? null,
        }
      : null,
    servico: row.servico
      ? {
          id: row.servico.id.toString(),
          nome: row.servico.nome,
          preco: Number(row.servico.preco),
        }
      : null,
  };
}

function serializeCotacao(row: any) {
  return {
    id: row.id.toString(),
    numero: row.numero,
    clienteId: row.clienteId.toString(),
    userId: row.userId.toString(),
    subtotal: Number(row.subtotal),
    desconto: Number(row.desconto),
    ivaTotal: Number(row.ivaTotal),
    total: Number(row.total),
    moeda: row.moeda,
    estado: row.estado,
    validade: row.validade.toISOString(),
    observacoes: row.observacoes ?? null,
    deletedAt: row.deletedAt?.toISOString?.() ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    cliente: row.cliente
      ? {
          id: row.cliente.id.toString(),
          nome: row.cliente.nome,
          telefone: row.cliente.telefone ?? null,
          nuit: row.cliente.nuit ?? null,
        }
      : null,
    user: row.user
      ? {
          id: row.user.id.toString(),
          name: row.user.name,
          role: row.user.role,
        }
      : null,
    itemCount: row._count?.items ?? row.items?.length ?? 0,
    items: row.items?.map(serializeCotacaoItem),
  };
}

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
            quantidadeAtual: { gt: 0 },
          },
          orderBy: { dataValidade: "asc" },
          take: 3,
          select: {
            id: true,
            numeroLote: true,
            dataValidade: true,
            precoVenda: true,
            quantidadeAtual: true,
            quantidadeQuarentena: true,
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
      nome: produto.nome,
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

  async create(data: CreateCotacaoDTO, userId: bigint) {
    await this.expireOverdueQuotes();

    const created = await this.prisma.$transaction(async (tx: PrismaTx) => {
      const cliente = await this.assertClienteExists(tx, BigInt(data.clienteId));

      const items = [];
      for (const item of data.items) {
        if (item.produtoId) {
          const produto = await this.loadProdutoSnapshot(tx, BigInt(item.produtoId));
          const precoUnit = item.precoUnit ?? produto.precoVenda;
          if (!Number.isFinite(precoUnit) || precoUnit <= 0) {
            throw new Error(`Produto ${produto.nome} sem preço de venda configurado`);
          }

          const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
            quantidade: item.quantidade,
            precoUnitario: precoUnit,
            taxRule: produto.taxRule
              ? {
                  codigo: produto.taxRule.codigo,
                  tipo: produto.taxRule.tipo,
                  taxa: Number(produto.taxRule.taxa),
                }
              : null,
            descricao: item.descricao ?? produto.nome,
          });

          items.push({
            produtoId: produto.id,
            servicoId: null,
            descricao: item.descricao ?? produto.nome,
            quantidade: item.quantidade,
            precoUnit,
            baseCalculo: fiscalCalc.baseCalculo,
            iva: fiscalCalc.taxaAplicadaPercentual,
            valorIva: fiscalCalc.valorIva,
            taxaAplicada: fiscalCalc.taxaAplicadaPercentual,
            tipoRegraFiscalSnapshot: fiscalCalc.tipoRegraFiscal,
            codigoRegraFiscal: fiscalCalc.codigoRegraFiscal,
            motivoIsencao: fiscalCalc.motivoIsencao,
            total: fiscalCalc.totalItem,
          });
          continue;
        }

        const servico = await this.loadServicoSnapshot(tx, BigInt(item.servicoId!));
        const precoUnit = item.precoUnit ?? Number(servico.preco);
        if (!Number.isFinite(precoUnit) || precoUnit <= 0) {
          throw new Error(`Serviço ${servico.nome} sem preço válido`);
        }

        const fiscalCalc = FiscalCalculatorUtil.calcularIVA({
          quantidade: item.quantidade,
          precoUnitario: precoUnit,
          taxRule: servico.taxRule
            ? {
                codigo: servico.taxRule.codigo,
                tipo: servico.taxRule.tipo,
                taxa: Number(servico.taxRule.taxa),
              }
            : null,
          descricao: item.descricao ?? servico.nome,
        });

        items.push({
          produtoId: null,
          servicoId: servico.id,
          descricao: item.descricao ?? servico.nome,
          quantidade: item.quantidade,
          precoUnit,
          baseCalculo: fiscalCalc.baseCalculo,
          iva: fiscalCalc.taxaAplicadaPercentual,
          valorIva: fiscalCalc.valorIva,
          taxaAplicada: fiscalCalc.taxaAplicadaPercentual,
          tipoRegraFiscalSnapshot: fiscalCalc.tipoRegraFiscal,
          codigoRegraFiscal: fiscalCalc.codigoRegraFiscal,
          motivoIsencao: fiscalCalc.motivoIsencao,
          total: fiscalCalc.totalItem,
        });
      }

      const totals = {
        subtotal: items.reduce((sum, item) => sum + Number(item.baseCalculo), 0),
        ivaTotal: items.reduce((sum, item) => sum + Number(item.valorIva), 0),
        total: items.reduce((sum, item) => sum + Number(item.total), 0),
      };
      const cotacao = await tx.cotacao.create({
        data: {
          numero: this.buildNumeroCotacao(),
          clienteId: BigInt(data.clienteId),
          userId,
          subtotal: totals.subtotal,
          desconto: 0,
          ivaTotal: totals.ivaTotal,
          total: totals.total,
          validade: data.validade,
          observacoes: data.observacoes ?? null,
          items: {
            create: items,
          },
        },
        include: {
          cliente: { select: { id: true, nome: true, telefone: true, nuit: true } },
          user: { select: { id: true, name: true, role: true } },
          items: {
            include: {
              produto: { select: { id: true, nome: true, barcode: true } },
              servico: { select: { id: true, nome: true, preco: true } },
            },
          },
          _count: { select: { items: true } },
        },
      });

      await this.audit.createImmutableLog(
        {
          userId,
          action: "CREATE",
          entity: "Cotacao",
          entityId: cotacao.id,
          after: serializeCotacao(cotacao),
        },
        tx,
      );

      return { cotacao, cliente };
    });

    return serializeCotacao(created.cotacao);
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
              { cliente: { nome: { contains: query } } },
              { items: { some: { descricao: { contains: query } } } },
            ],
          }
        : {}),
    };

    const orderBy =
      sortBy === "validade"
        ? [{ validade: sortOrder }, { id: sortOrder }]
        : sortBy === "numero"
          ? [{ numero: sortOrder }, { id: sortOrder }]
          : sortBy === "total"
            ? [{ total: sortOrder }, { id: sortOrder }]
            : sortBy === "clienteNome"
              ? [{ cliente: { nome: sortOrder } }, { id: sortOrder }]
              : [{ createdAt: sortOrder }, { id: sortOrder }];

    const [totalCount, rows] = await this.prisma.$transaction([
      this.prisma.cotacao.count({ where }),
      this.prisma.cotacao.findMany({
        where,
        include: {
          cliente: { select: { id: true, nome: true, telefone: true, nuit: true } },
          user: { select: { id: true, name: true, role: true } },
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
      include: {
        cliente: { select: { id: true, nome: true, telefone: true, nuit: true } },
        user: { select: { id: true, name: true, role: true } },
        items: {
          include: {
            produto: { select: { id: true, nome: true, barcode: true } },
            servico: { select: { id: true, nome: true, preco: true } },
          },
          orderBy: { id: "asc" },
        },
        _count: { select: { items: true } },
      },
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
      include: {
        cliente: { select: { id: true, nome: true, telefone: true, nuit: true } },
        user: { select: { id: true, name: true, role: true } },
        items: {
          include: {
            produto: { select: { id: true, nome: true, barcode: true } },
            servico: { select: { id: true, nome: true, preco: true } },
          },
        },
        _count: { select: { items: true } },
      },
    });

    if (!existing) {
      throw new Error("Cotação não encontrada");
    }

    this.assertCanMutate(existing, "editar");

    const updated = await this.prisma.$transaction(async (tx: PrismaTx) => {
      if (data.clienteId) {
        await this.assertClienteExists(tx, BigInt(data.clienteId));
      }

      const row = await tx.cotacao.update({
        where: { id, version: existing.version },
        data: {
          ...(data.clienteId ? { clienteId: BigInt(data.clienteId) } : {}),
          ...(data.validade ? { validade: data.validade } : {}),
          ...(data.observacoes !== undefined
            ? { observacoes: data.observacoes ?? null }
            : {}),
          version: { increment: 1 },
        },
        include: {
          cliente: { select: { id: true, nome: true, telefone: true, nuit: true } },
          user: { select: { id: true, name: true, role: true } },
          items: {
            include: {
              produto: { select: { id: true, nome: true, barcode: true } },
              servico: { select: { id: true, nome: true, preco: true } },
            },
          },
          _count: { select: { items: true } },
        },
      });

      await this.audit.createImmutableLog(
        {
          userId,
          action: "UPDATE",
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

  async softDelete(id: bigint, userId: bigint) {
    await this.expireOverdueQuotes();

    const existing = await this.prisma.cotacao.findFirst({
      where: { id, deletedAt: null },
      include: {
        cliente: { select: { id: true, nome: true, telefone: true, nuit: true } },
        user: { select: { id: true, name: true, role: true } },
        items: {
          include: {
            produto: { select: { id: true, nome: true, barcode: true } },
            servico: { select: { id: true, nome: true, preco: true } },
          },
        },
        _count: { select: { items: true } },
      },
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
      include: {
        cliente: { select: { id: true, nome: true, telefone: true, nuit: true } },
        user: { select: { id: true, name: true, role: true } },
        items: {
          include: {
            produto: { select: { id: true, nome: true, barcode: true } },
            servico: { select: { id: true, nome: true, preco: true } },
          },
        },
        _count: { select: { items: true } },
      },
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
          observacoes:
            observacoes && observacoes.trim().length > 0
              ? [existing.observacoes, observacoes.trim()].filter(Boolean).join("\n\n")
              : existing.observacoes,
          version: { increment: 1 },
        },
        include: {
          cliente: { select: { id: true, nome: true, telefone: true, nuit: true } },
          user: { select: { id: true, name: true, role: true } },
          items: {
            include: {
              produto: { select: { id: true, nome: true, barcode: true } },
              servico: { select: { id: true, nome: true, preco: true } },
            },
          },
          _count: { select: { items: true } },
        },
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
