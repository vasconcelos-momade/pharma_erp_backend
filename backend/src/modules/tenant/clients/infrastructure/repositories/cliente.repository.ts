import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ComplianceAuditService } from "../../../../../shared/services/compliance-audit.service";
import { parseDateRange } from "../../../regulatory/application/use-cases/regulatory.helpers";
import type { CreateClienteDTO, UpdateClienteDTO } from "../../application/dto/cliente.dto";
import {
  DEFAULT_CLIENTE_NAMES,
} from "../../domain/default-cliente";

type ClienteSearchFilters = {
  query?: string;
  tipo?: string;
  empresaId?: bigint;
  comCredito?: boolean;
  temPrescricao?: boolean;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "nome" | "createdAt" | "saldoAtual";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

function serializeCliente(row: any) {
  return {
    id: row.id.toString(),
    nome: row.nome,
    telefone: row.telefone ?? null,
    email: row.email ?? null,
    tipo: row.tipo,
    documento: row.documento ?? null,
    dataNascimento: row.dataNascimento?.toISOString?.() ?? row.dataNascimento ?? null,
    sexo: row.sexo ?? null,
    nuit: row.nuit ?? null,
    endereco: row.endereco ?? null,
    empresaId: row.empresaId?.toString() ?? null,
    limiteCredito: row.limiteCredito != null ? Number(row.limiteCredito) : null,
    saldoAtual: Number(row.saldoAtual ?? 0),
    temPrescricao: Boolean(row.temPrescricao),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    empresa: row.empresa
      ? {
          id: row.empresa.id.toString(),
          nome: row.empresa.nome,
          nuit: row.empresa.nuit ?? null,
        }
      : null,
    _count: row._count
      ? {
          faturas: row._count.faturas ?? 0,
          contasReceber: row._count.contasReceber ?? 0,
          receitas: row._count.receitas ?? 0,
        }
      : undefined,
  };
}

export class ClienteRepository {
  private audit = new ComplianceAuditService();

  private get prisma() {
    return getPrisma() as any;
  }

  async create(data: CreateClienteDTO, userId: bigint) {
    const created = await this.prisma.$transaction(async (tx: any) => {
      const cliente = await tx.cliente.create({
        data: {
          nome: data.nome,
          telefone: data.telefone ?? null,
          email: data.email ?? null,
          tipo: data.tipo,
          documento: data.documento ?? null,
          dataNascimento: data.dataNascimento ? new Date(data.dataNascimento) : null,
          sexo: data.sexo ?? null,
          nuit: data.nuit ?? null,
          endereco: data.endereco ?? null,
          empresaId: data.empresaId ? BigInt(data.empresaId) : null,
          limiteCredito: data.limiteCredito ?? null,
          temPrescricao: data.temPrescricao ?? false,
        },
        include: {
          empresa: { select: { id: true, nome: true, nuit: true } },
        },
      });

      await this.audit.createImmutableLog(
        {
          userId,
          action: "CREATE",
          entity: "Cliente",
          entityId: cliente.id,
          after: serializeCliente(cliente),
        },
        tx,
      );

      return cliente;
    });

    return serializeCliente(created);
  }

  async update(id: bigint, data: UpdateClienteDTO, userId: bigint) {
    const existing = await this.prisma.cliente.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new Error("Cliente não encontrado");

    const updated = await this.prisma.$transaction(async (tx: any) => {
      const cliente = await tx.cliente.update({
        where: { id, version: existing.version },
        data: {
          ...(data.nome !== undefined ? { nome: data.nome } : {}),
          ...(data.telefone !== undefined ? { telefone: data.telefone ?? null } : {}),
          ...(data.email !== undefined ? { email: data.email ?? null } : {}),
          ...(data.tipo !== undefined ? { tipo: data.tipo } : {}),
          ...(data.documento !== undefined ? { documento: data.documento ?? null } : {}),
          ...(data.dataNascimento !== undefined
            ? { dataNascimento: data.dataNascimento ? new Date(data.dataNascimento) : null }
            : {}),
          ...(data.sexo !== undefined ? { sexo: data.sexo ?? null } : {}),
          ...(data.nuit !== undefined ? { nuit: data.nuit ?? null } : {}),
          ...(data.endereco !== undefined ? { endereco: data.endereco ?? null } : {}),
          ...(data.empresaId !== undefined
            ? { empresaId: data.empresaId ? BigInt(data.empresaId) : null }
            : {}),
          ...(data.limiteCredito !== undefined ? { limiteCredito: data.limiteCredito ?? null } : {}),
          ...(data.temPrescricao !== undefined ? { temPrescricao: data.temPrescricao } : {}),
          version: { increment: 1 },
        },
        include: {
          empresa: { select: { id: true, nome: true, nuit: true } },
        },
      });

      await this.audit.createImmutableLog(
        {
          userId,
          action: "UPDATE",
          entity: "Cliente",
          entityId: id,
          before: serializeCliente(existing),
          after: serializeCliente(cliente),
        },
        tx,
      );

      return cliente;
    });

    return serializeCliente(updated);
  }

  async softDelete(id: bigint, userId: bigint) {
    const existing = await this.prisma.cliente.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new Error("Cliente não encontrado");

    await this.prisma.$transaction(async (tx: any) => {
      await tx.cliente.update({
        where: { id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      await this.audit.createImmutableLog(
        {
          userId,
          action: "DELETE",
          entity: "Cliente",
          entityId: id,
          before: serializeCliente(existing),
        },
        tx,
      );
    });
  }

  async search(filters: ClienteSearchFilters = {}) {
    const query = (filters.query ?? "").trim() || undefined;
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const sortBy = filters.sortBy ?? "nome";
    const sortOrder = filters.sortOrder === "desc" ? "desc" : "asc";
    const { from, to } = parseDateRange(filters.dateFrom, filters.dateTo);

    const where: any = {
      deletedAt: null,
      // Cliente padrão de PDV não aparece nas listagens operacionais.
      NOT: {
        OR: DEFAULT_CLIENTE_NAMES.map((nome) => ({ nome })),
      },
      ...(filters.tipo ? { tipo: filters.tipo } : {}),
      ...(filters.empresaId ? { empresaId: filters.empresaId } : {}),
      ...(filters.temPrescricao !== undefined ? { temPrescricao: filters.temPrescricao } : {}),
      ...(filters.comCredito ? { saldoAtual: { gt: 0 } } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { nome: { contains: query } },
              { telefone: { contains: query } },
              { nuit: { contains: query } },
              { documento: { contains: query } },
              { email: { contains: query } },
              { empresa: { nome: { contains: query } } },
            ],
          }
        : {}),
    };

    const orderBy =
      sortBy === "createdAt"
        ? [{ createdAt: sortOrder }, { id: sortOrder }]
        : sortBy === "saldoAtual"
          ? [{ saldoAtual: sortOrder }, { nome: "asc" }]
          : [{ nome: sortOrder }, { id: sortOrder }];

    const [totalCount, rows] = await this.prisma.$transaction([
      this.prisma.cliente.count({ where }),
      this.prisma.cliente.findMany({
        where,
        include: {
          empresa: { select: { id: true, nome: true, nuit: true } },
          _count: { select: { faturas: true, contasReceber: true, receitas: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, pageSize).map(serializeCliente),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }

  async getById(id: bigint) {
    const row = await this.prisma.cliente.findFirst({
      where: { id, deletedAt: null },
      include: {
        empresa: { select: { id: true, nome: true, nuit: true, limiteCredito: true, saldoUsado: true, ativo: true } },
        _count: { select: { faturas: true, contasReceber: true, receitas: true } },
      },
    });
    if (!row) throw new Error("Cliente não encontrado");
    return serializeCliente(row);
  }

  async getDashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, novosMes, comCredito, comFaturasRecentes] = await Promise.all([
      this.prisma.cliente.count({ where: { deletedAt: null } }),
      this.prisma.cliente.count({
        where: { deletedAt: null, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.cliente.count({
        where: { deletedAt: null, saldoAtual: { gt: 0 } },
      }),
      this.prisma.cliente.count({
        where: {
          deletedAt: null,
          faturas: {
            some: {
              deletedAt: null,
              createdAt: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
            },
          },
        },
      }),
    ]);

    return {
      totalClientes: total,
      novosClientes: novosMes,
      clientesAtivos: comFaturasRecentes,
      clientesComCredito: comCredito,
    };
  }

  async listFaturas(clienteId: bigint, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const where = { clienteId, deletedAt: null };

    const [totalCount, rows] = await this.prisma.$transaction([
      this.prisma.fatura.count({ where }),
      this.prisma.fatura.findMany({
        where,
        select: {
          id: true,
          numero: true,
          serie: true,
          total: true,
          estado: true,
          tipoPagamento: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (safePage - 1) * safeSize,
        take: safeSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, safeSize).map((r: any) => ({
        id: r.id.toString(),
        numero: r.numero,
        serie: r.serie,
        total: Number(r.total),
        estado: r.estado,
        tipoPagamento: r.tipoPagamento,
        createdAt: r.createdAt.toISOString(),
        user: r.user ? { id: r.user.id.toString(), nome: r.user.name } : null,
      })),
      page: safePage,
      pageSize: safeSize,
      hasMore: rows.length > safeSize,
      totalCount,
    };
  }

  async listContasReceber(clienteId: bigint, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const where = { clienteId };

    const [totalCount, rows] = await this.prisma.$transaction([
      this.prisma.contaReceber.count({ where }),
      this.prisma.contaReceber.findMany({
        where,
        include: {
          fatura: { select: { id: true, numero: true, serie: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (safePage - 1) * safeSize,
        take: safeSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, safeSize).map((r: any) => ({
        id: r.id.toString(),
        valor: Number(r.valor),
        saldo: Number(r.saldo),
        status: r.status,
        vencimento: r.vencimento?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        fatura: r.fatura
          ? { id: r.fatura.id.toString(), numero: r.fatura.numero, serie: r.fatura.serie }
          : null,
      })),
      page: safePage,
      pageSize: safeSize,
      hasMore: rows.length > safeSize,
      totalCount,
    };
  }

  async listReceitas(clienteId: bigint, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const where = { clienteId };

    const [totalCount, rows] = await this.prisma.$transaction([
      this.prisma.receita.count({ where }),
      this.prisma.receita.findMany({
        where,
        orderBy: [{ dataReceita: "desc" }, { id: "desc" }],
        skip: (safePage - 1) * safeSize,
        take: safeSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, safeSize).map((r: any) => ({
        id: r.id.toString(),
        medicoNome: r.medicoNome ?? null,
        numeroReceita: r.numeroReceita ?? null,
        unidadeSanitaria: r.unidadeSanitaria ?? null,
        dataReceita: r.dataReceita.toISOString(),
        observacoes: r.observacoes ?? null,
      })),
      page: safePage,
      pageSize: safeSize,
      hasMore: rows.length > safeSize,
      totalCount,
    };
  }

  async listAuditLogs(clienteId: bigint, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const where = { entity: "Cliente", entityId: clienteId };

    const [totalCount, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (safePage - 1) * safeSize,
        take: safeSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, safeSize).map((row: any) => ({
        id: row.id.toString(),
        action: row.action,
        before: row.before ?? null,
        after: row.after ?? null,
        createdAt: row.createdAt.toISOString(),
        user: row.user
          ? { id: row.user.id.toString(), nome: row.user.name, email: row.user.email ?? null }
          : null,
      })),
      page: safePage,
      pageSize: safeSize,
      hasMore: rows.length > safeSize,
      totalCount,
    };
  }
}
