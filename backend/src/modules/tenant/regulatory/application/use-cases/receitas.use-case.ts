import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../shared/http/api-error";
import {
  inferReceitaStatus,
  normalizePage,
  parseDateRange,
} from "./regulatory.helpers";

type ReceitasDashboardParams = {
  from?: string;
  to?: string;
  clienteId?: string;
  search?: string;
};

type ListReceitasParams = ReceitasDashboardParams & {
  status?: "EMITIDA" | "UTILIZADA" | "PENDENTE" | "EXPIRADA";
  origem?: "FISICA" | "DIGITAL" | "SISTEMA_INTERNO";
  sortBy?: "dataReceita" | "createdAt" | "numeroReceita" | "clienteNome";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

type ReceitaPayload = {
  clienteId: string;
  medicoNome?: string | null;
  numeroReceita?: string | null;
  unidadeSanitaria?: string | null;
  dataReceita: string;
  observacoes?: string | null;
};

function buildReceitaWhere(params: ReceitasDashboardParams) {
  const { from, to } = parseDateRange(params.from, params.to);
  const search = params.search?.trim();

  return {
    ...(params.clienteId ? { clienteId: BigInt(params.clienteId) } : {}),
    ...(from || to
      ? {
          dataReceita: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { numeroReceita: { contains: search } },
            { medicoNome: { contains: search } },
            { unidadeSanitaria: { contains: search } },
            { cliente: { nome: { contains: search } } },
            { cliente: { documento: { contains: search } } },
          ],
        }
      : {}),
  };
}

function buildReceitaListWhere(params: ListReceitasParams) {
  const where: Record<string, unknown> = {
    ...buildReceitaWhere(params),
  };
  const now = new Date();
  const expiryCutoff = new Date(now);
  expiryCutoff.setDate(expiryCutoff.getDate() - 30);

  const appendAnd = (condition: Record<string, unknown>) => {
    const current = Array.isArray(where.AND) ? where.AND : [];
    where.AND = [...current, condition];
  };

  if (params.status === "UTILIZADA") {
    appendAnd({
      OR: [
        { dispensacoes: { some: {} } },
        { livroReceitas: { some: {} } },
      ],
    });
  } else if (params.status === "EXPIRADA") {
    appendAnd({
      AND: [
        { dataReceita: { lt: expiryCutoff } },
        { dispensacoes: { none: {} } },
        { livroReceitas: { none: {} } },
      ],
    });
  } else if (params.status === "PENDENTE") {
    appendAnd({
      AND: [
        { dataReceita: { gte: expiryCutoff } },
        { dispensacoes: { none: {} } },
        { livroReceitas: { none: {} } },
      ],
    });
  }

  if (params.origem === "DIGITAL") {
    appendAnd({ origemReceita: "DIGITAL" });
  } else if (params.origem === "SISTEMA_INTERNO") {
    appendAnd({ origemReceita: "SISTEMA_INTERNO" });
  } else if (params.origem === "FISICA") {
    appendAnd({ origemReceita: "FISICA" });
  }

  return where;
}

function mapReceitaRow(row: any, now = new Date()) {
  const livroMovimentosCount = row._count?.livroReceitas ?? 0;
  const dispensacoesCount = row._count?.dispensacoes ?? 0;
  const origem = String(row.origemReceita ?? "FISICA");
  const status =
    dispensacoesCount > 0 || livroMovimentosCount > 0
      ? "UTILIZADA"
      : inferReceitaStatus(
          {
            dataReceita: row.dataReceita,
            dispensacoesCount,
            livroSaidasCount: livroMovimentosCount,
          },
          now,
        );

  return {
    id: row.id.toString(),
    clienteId: row.clienteId.toString(),
    numeroReceita: row.numeroReceita,
    medicoNome: row.medicoNome,
    unidadeSanitaria: row.unidadeSanitaria,
    dataReceita: row.dataReceita.toISOString(),
    observacoes: row.observacoes,
    createdAt: row.createdAt.toISOString(),
    status,
    origem,
    cliente: row.cliente
      ? {
          id: row.cliente.id.toString(),
          nome: row.cliente.nome,
          documento: row.cliente.documento,
          telefone: row.cliente.telefone,
        }
      : null,
    dispensacoesCount,
    livroMovimentosCount: row._count?.livroReceitas ?? 0,
    ultimaDispensacaoAt: row.dispensacoes?.[0]?.createdAt?.toISOString() ?? null,
  };
}

export class ReceitasDashboardUseCase {
  async execute(params: ReceitasDashboardParams = {}) {
    const prisma = getPrisma() as any;
    const where = buildReceitaWhere(params);
    const now = new Date();
    const expiryCutoff = new Date(now);
    expiryCutoff.setDate(expiryCutoff.getDate() - 30);

    const [rows, digitalCount, latestRows] = await Promise.all([
      prisma.receita.findMany({
        where,
        select: {
          id: true,
          dataReceita: true,
          origemReceita: true,
          dispensacoes: { select: { id: true } },
          livroReceitas: { select: { id: true } },
        },
      }),
      prisma.receita.count({
        where: {
          ...where,
          origemReceita: "DIGITAL",
        },
      }),
      prisma.receita.findMany({
        where,
        include: {
          cliente: {
            select: {
              id: true,
              nome: true,
              documento: true,
            },
          },
          dispensacoes: {
            select: {
              id: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: {
            select: {
              livroReceitas: true,
              dispensacoes: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 5,
      }),
    ]);

    let utilizadas = 0;
    let pendentes = 0;
    let expiradas = 0;
    let fisicas = 0;

    for (const row of rows) {
      const used =
        (row.dispensacoes?.length ?? 0) > 0 ||
        (row.livroReceitas?.length ?? 0) > 0;
      const origem = String(row.origemReceita ?? "FISICA");
      if (origem !== "DIGITAL") {
        fisicas += 1;
      }
      if (used) {
        utilizadas += 1;
      } else if (row.dataReceita < expiryCutoff) {
        expiradas += 1;
      } else {
        pendentes += 1;
      }
    }

    return {
      kpis: {
        emitidas: rows.length,
        utilizadas,
        pendentes,
        expiradas,
        fisicas,
        digitais: digitalCount,
      },
      latest: latestRows.map((row: any) => mapReceitaRow(row, now)),
    };
  }
}

export class ListReceitasUseCase {
  async execute(params: ListReceitasParams = {}) {
    const prisma = getPrisma() as any;
    const { page, pageSize } = normalizePage(params.page, params.pageSize);
    const where = buildReceitaListWhere(params);
    const sortDir = params.sortDir === "asc" ? "asc" : "desc";

    const orderBy =
      params.sortBy === "numeroReceita"
        ? [{ numeroReceita: sortDir }, { id: "desc" }]
        : params.sortBy === "clienteNome"
          ? [{ cliente: { nome: sortDir } }, { id: "desc" }]
          : params.sortBy === "createdAt"
            ? [{ createdAt: sortDir }, { id: "desc" }]
            : [{ dataReceita: sortDir }, { id: "desc" }];

    const [rows, totalCount] = await Promise.all([
      prisma.receita.findMany({
        where,
        include: {
          cliente: {
            select: {
              id: true,
              nome: true,
              documento: true,
              telefone: true,
            },
          },
          livroReceitas: {
            select: {
              id: true,
              createdAt: true,
              dispensacao: {
                select: {
                  quantidade: true,
                  produto: { select: { id: true, nomeComercial: true } },
                  lote: { select: { id: true, numeroLote: true } },
                },
              },
              responsavel: { select: { id: true, name: true, role: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          dispensacoes: {
            select: {
              id: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: {
            select: {
              livroReceitas: true,
              dispensacoes: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
      prisma.receita.count({ where }),
    ]);

    const now = new Date();
    return {
      items: rows.slice(0, pageSize).map((row: any) => mapReceitaRow(row, now)),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }
}

export class GetReceitaDetailUseCase {
  async execute(receitaId: string) {
    const prisma = getPrisma() as any;
    const id = BigInt(receitaId);
    const receita = await prisma.receita.findUnique({
      where: { id },
      include: {
        cliente: true,
        dispensacoes: {
          include: {
            produto: { select: { id: true, nomeComercial: true } },
            lote: { select: { id: true, numeroLote: true, dataValidade: true } },
            user: { select: { id: true, name: true } },
            validadoPor: { select: { id: true, name: true } },
            fatura: { select: { id: true, numero: true, total: true, createdAt: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        livroReceitas: {
          include: {
            dispensacao: {
              select: {
                quantidade: true,
                produto: { select: { id: true, nomeComercial: true } },
                lote: { select: { id: true, numeroLote: true } },
                fatura: { select: { id: true, numero: true, total: true } },
              },
            },
            responsavel: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!receita) {
      throw new NotFoundApiError("Receita não encontrada");
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: "Receita", entityId: id },
          { entity: "LivroReceita", entityId: { in: receita.livroReceitas.map((item: any) => item.id) } },
          { entity: "Dispensacao", entityId: { in: receita.dispensacoes.map((item: any) => item.id) } },
        ],
      },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const timeline = [
      {
        type: "RECEITA_CRIADA",
        at: receita.createdAt.toISOString(),
        description: `Receita ${receita.numeroReceita || `#${receita.id}` } criada`,
      },
      ...receita.livroReceitas.map((item: any) => ({
        type: "LIVRO_SAIDA",
        at: item.createdAt.toISOString(),
        description: "Movimento SAIDA no livro de receitas",
        productName: item.dispensacao?.produto?.nomeComercial ?? null,
        quantity: item.dispensacao?.quantidade != null
          ? Number(item.dispensacao.quantidade)
          : null,
      })),
      ...receita.dispensacoes.map((item: any) => ({
        type: "DISPENSACAO",
        at: item.createdAt.toISOString(),
        description: "Dispensação vinculada à receita",
        productName: item.produto?.nomeComercial ?? null,
        quantity: item.quantidade,
      })),
    ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

    return {
      ...mapReceitaRow({
        ...receita,
        _count: {
          livroReceitas: receita.livroReceitas.length,
          dispensacoes: receita.dispensacoes.length,
        },
      }),
      dispensacoes: receita.dispensacoes.map((item: any) => ({
        id: item.id.toString(),
        quantidade: Number(item.quantidade),
        tipoDispensacao: item.tipoDispensacao,
        isControlado: item.isControlado,
        isPsicotropico: item.isPsicotropico,
        receitaVerificada: item.receitaVerificada,
        receitaValida: item.receitaValida,
        createdAt: item.createdAt.toISOString(),
        produto: item.produto
          ? { id: item.produto.id.toString(), nome: item.produto.nomeComercial }
          : null,
        lote: item.lote
          ? {
              id: item.lote.id.toString(),
              numeroLote: item.lote.numeroLote,
              dataValidade: item.lote.dataValidade.toISOString(),
            }
          : null,
        user: item.user
          ? { id: item.user.id.toString(), name: item.user.name }
          : null,
        validadoPor: item.validadoPor
          ? { id: item.validadoPor.id.toString(), name: item.validadoPor.name }
          : null,
        fatura: item.fatura
          ? {
              id: item.fatura.id.toString(),
              numero: item.fatura.numero,
              total: Number(item.fatura.total),
              createdAt: item.fatura.createdAt.toISOString(),
            }
          : null,
      })),
      livroReceitas: receita.livroReceitas.map((item: any) => ({
        id: item.id.toString(),
        tipoMovimento: "SAIDA",
        origemReceita: receita.origemReceita,
        quantidade: Number(item.dispensacao?.quantidade ?? 0),
        saldoAnterior: null,
        saldoAtual: null,
        numeroReceita: receita.numeroReceita,
        medicoNome: receita.medicoNome,
        observacoes: null,
        createdAt: item.createdAt.toISOString(),
        produto: item.dispensacao?.produto
          ? {
              id: item.dispensacao.produto.id.toString(),
              nome: item.dispensacao.produto.nomeComercial,
            }
          : null,
        lote: item.dispensacao?.lote
          ? {
              id: item.dispensacao.lote.id.toString(),
              numeroLote: item.dispensacao.lote.numeroLote,
            }
          : null,
        responsavel: item.responsavel
          ? {
              id: item.responsavel.id.toString(),
              name: item.responsavel.name,
              role: item.responsavel.role,
            }
          : null,
        fatura: item.dispensacao?.fatura
          ? {
              id: item.dispensacao.fatura.id.toString(),
              numero: item.dispensacao.fatura.numero,
              total: Number(item.dispensacao.fatura.total),
            }
          : null,
      })),
      auditLogs: auditLogs.map((item: any) => ({
        id: item.id.toString(),
        action: item.action,
        entity: item.entity,
        entityId: item.entityId?.toString() ?? null,
        createdAt: item.createdAt.toISOString(),
        user: item.user
          ? {
              id: item.user.id.toString(),
              name: item.user.name,
              role: item.user.role,
            }
          : null,
      })),
      timeline,
    };
  }
}

export class CreateReceitaUseCase {
  async execute(payload: ReceitaPayload) {
    const prisma = getPrisma() as any;
    const dataReceita = new Date(payload.dataReceita);
    if (Number.isNaN(dataReceita.getTime())) {
      throw new ValidationApiError("dataReceita inválida");
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id: BigInt(payload.clienteId) },
      select: { id: true, nome: true },
    });

    if (!cliente) {
      throw new NotFoundApiError("Cliente não encontrado");
    }

    const receita = await prisma.receita.create({
      data: {
        clienteId: BigInt(payload.clienteId),
        medicoNome: payload.medicoNome ?? null,
        numeroReceita: payload.numeroReceita ?? null,
        unidadeSanitaria: payload.unidadeSanitaria ?? null,
        dataReceita,
        observacoes: payload.observacoes ?? null,
      },
      include: {
        cliente: {
          select: { id: true, nome: true, documento: true, telefone: true },
        },
        livroReceitas: { select: { id: true }, take: 1 },
        _count: { select: { livroReceitas: true, dispensacoes: true } },
        dispensacoes: {
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return mapReceitaRow(receita);
  }
}

export class UpdateReceitaUseCase {
  async execute(receitaId: string, payload: Partial<ReceitaPayload>) {
    const prisma = getPrisma() as any;
    const id = BigInt(receitaId);
    const existing = await prisma.receita.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundApiError("Receita não encontrada");
    }

    if (payload.clienteId) {
      const cliente = await prisma.cliente.findUnique({
        where: { id: BigInt(payload.clienteId) },
        select: { id: true },
      });
      if (!cliente) {
        throw new NotFoundApiError("Cliente não encontrado");
      }
    }

    const dataReceita =
      payload.dataReceita != null ? new Date(payload.dataReceita) : undefined;
    if (dataReceita && Number.isNaN(dataReceita.getTime())) {
      throw new ValidationApiError("dataReceita inválida");
    }

    const receita = await prisma.receita.update({
      where: { id },
      data: {
        ...(payload.clienteId ? { clienteId: BigInt(payload.clienteId) } : {}),
        ...(payload.medicoNome !== undefined ? { medicoNome: payload.medicoNome } : {}),
        ...(payload.numeroReceita !== undefined
          ? { numeroReceita: payload.numeroReceita }
          : {}),
        ...(payload.unidadeSanitaria !== undefined
          ? { unidadeSanitaria: payload.unidadeSanitaria }
          : {}),
        ...(payload.observacoes !== undefined
          ? { observacoes: payload.observacoes }
          : {}),
        ...(dataReceita ? { dataReceita } : {}),
      },
      include: {
        cliente: {
          select: { id: true, nome: true, documento: true, telefone: true },
        },
        livroReceitas: { select: { id: true }, take: 1 },
        _count: { select: { livroReceitas: true, dispensacoes: true } },
        dispensacoes: {
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return mapReceitaRow(receita);
  }
}

export class DeleteReceitaUseCase {
  async execute(receitaId: string) {
    const prisma = getPrisma() as any;
    const id = BigInt(receitaId);
    const existing = await prisma.receita.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            livroReceitas: true,
            dispensacoes: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundApiError("Receita não encontrada");
    }

    if (existing._count.livroReceitas > 0 || existing._count.dispensacoes > 0) {
      throw new ValidationApiError(
        "Não é possível remover uma receita com movimentações ou dispensações vinculadas",
      );
    }

    await prisma.receita.delete({ where: { id } });

    return { success: true, id: receitaId };
  }
}
