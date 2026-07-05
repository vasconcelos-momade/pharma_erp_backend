import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { NotFoundApiError } from "../../../../../shared/http/api-error";
import {
  normalizePage,
  parseDateRange,
  toNumber,
} from "./regulatory.helpers";

const livroReceitaInclude = {
  receita: {
    select: {
      id: true,
      numeroReceita: true,
      medicoNome: true,
      unidadeSanitaria: true,
      dataReceita: true,
      origemReceita: true,
      clienteId: true,
      cliente: { select: { id: true, nome: true, documento: true } },
    },
  },
  responsavel: { select: { id: true, name: true, role: true } },
  dispensacao: {
    select: {
      id: true,
      produtoId: true,
      loteId: true,
      faturaId: true,
      faturaItemId: true,
      quantidade: true,
      tipoDispensacao: true,
      createdAt: true,
      produto: { select: { id: true, nomeComercial: true, barcode: true } },
      lote: { select: { id: true, numeroLote: true, dataValidade: true } },
      fatura: {
        select: {
          id: true,
          numero: true,
          total: true,
          createdAt: true,
          clienteId: true,
          cliente: { select: { id: true, nome: true, documento: true } },
        },
      },
    },
  },
} as const;

type ListLivroReceitasParams = {
  search?: string;
  clienteId?: string;
  produtoId?: string;
  responsavelId?: string;
  origem?: "FISICA" | "DIGITAL" | "SISTEMA_INTERNO";
  tipoMovimento?: "ENTRADA" | "SAIDA" | "CANCELAMENTO" | "AJUSTE";
  from?: string;
  to?: string;
  sortBy?: "createdAt" | "dataReceita" | "numeroReceita" | "produtoNomeComercial" | "clienteNome";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

function buildLivroReceitaWhere(params: ListLivroReceitasParams) {
  const { from, to } = parseDateRange(params.from, params.to);
  const search = params.search?.trim();

  return {
    ...(params.clienteId
      ? {
          OR: [
            { receita: { clienteId: BigInt(params.clienteId) } },
            { dispensacao: { fatura: { clienteId: BigInt(params.clienteId) } } },
          ],
        }
      : {}),
    ...(params.produtoId
      ? { dispensacao: { produtoId: BigInt(params.produtoId) } }
      : {}),
    ...(params.responsavelId ? { responsavelId: BigInt(params.responsavelId) } : {}),
    ...(params.origem ? { receita: { origemReceita: params.origem } } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { receita: { numeroReceita: { contains: search } } },
            { receita: { medicoNome: { contains: search } } },
            { receita: { cliente: { nome: { contains: search } } } },
            { dispensacao: { fatura: { cliente: { nome: { contains: search } } } } },
            { dispensacao: { produto: { nomeComercial: { contains: search } } } },
            { dispensacao: { lote: { numeroLote: { contains: search } } } },
            { dispensacao: { fatura: { numero: { contains: search } } } },
          ],
        }
      : {}),
  };
}

function mapLivroReceitaRow(row: any) {
  const dispensacao = row.dispensacao;
  const receita = row.receita ?? dispensacao?.receita;
  const cliente =
    receita?.cliente ??
    dispensacao?.fatura?.cliente ??
    null;

  return {
    id: row.id.toString(),
    receitaId: row.receitaId.toString(),
    clienteId: (cliente?.id ?? receita?.clienteId ?? dispensacao?.fatura?.clienteId)?.toString(),
    produtoId: dispensacao?.produtoId?.toString() ?? null,
    loteId: dispensacao?.loteId?.toString() ?? null,
    faturaId: dispensacao?.faturaId?.toString() ?? null,
    faturaItemId: dispensacao?.faturaItemId?.toString() ?? null,
    dispensacaoId: row.dispensacaoId.toString(),
    tipoMovimento: "SAIDA",
    quantidade: toNumber(dispensacao?.quantidade),
    saldoAnterior: null,
    saldoAtual: null,
    medicoNome: receita?.medicoNome ?? null,
    numeroReceita: receita?.numeroReceita ?? null,
    dataReceita: receita?.dataReceita?.toISOString?.() ?? null,
    origemReceita: receita?.origemReceita ?? "FISICA",
    observacoes: null,
    createdAt: row.createdAt.toISOString(),
    receita: receita
      ? {
          id: receita.id.toString(),
          numeroReceita: receita.numeroReceita,
          medicoNome: receita.medicoNome,
          unidadeSanitaria: receita.unidadeSanitaria,
        }
      : null,
    cliente: cliente
      ? {
          id: cliente.id.toString(),
          nome: cliente.nome,
          documento: cliente.documento,
        }
      : null,
    produto: dispensacao?.produto
      ? {
          id: dispensacao.produto.id.toString(),
          nome: dispensacao.produto.nomeComercial,
          barcode: dispensacao.produto.barcode,
        }
      : null,
    lote: dispensacao?.lote
      ? {
          id: dispensacao.lote.id.toString(),
          numeroLote: dispensacao.lote.numeroLote,
          dataValidade: dispensacao.lote.dataValidade?.toISOString?.() ?? null,
        }
      : null,
    responsavel: row.responsavel
      ? {
          id: row.responsavel.id.toString(),
          name: row.responsavel.name,
          role: row.responsavel.role,
        }
      : null,
    dispensacao: dispensacao
      ? {
          id: dispensacao.id.toString(),
          quantidade: toNumber(dispensacao.quantidade),
          tipoDispensacao: dispensacao.tipoDispensacao,
          createdAt: dispensacao.createdAt.toISOString(),
        }
      : null,
    fatura: dispensacao?.fatura
      ? {
          id: dispensacao.fatura.id.toString(),
          numero: dispensacao.fatura.numero,
          total: toNumber(dispensacao.fatura.total),
          createdAt: dispensacao.fatura.createdAt?.toISOString?.() ?? null,
        }
      : null,
  };
}

export class LivroReceitasDashboardUseCase {
  async execute(params: Omit<ListLivroReceitasParams, "sortBy" | "sortDir" | "page" | "pageSize"> = {}) {
    const prisma = getPrisma() as any;
    const where = buildLivroReceitaWhere(params);

    const [totalMovimentos, pacientesUnicos, latest] = await Promise.all([
      prisma.livroReceita.count({ where }),
      prisma.livroReceita.findMany({
        where,
        distinct: ["receitaId"],
        select: { receita: { select: { clienteId: true } } },
      }),
      prisma.livroReceita.findMany({
        where,
        include: livroReceitaInclude,
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      kpis: {
        totalMovimentos,
        entradas: 0,
        saidas: totalMovimentos,
        pacientesUnicos: pacientesUnicos.length,
      },
      latest: latest.map(mapLivroReceitaRow),
    };
  }
}

export class ListLivroReceitasUseCase {
  async execute(params: ListLivroReceitasParams = {}) {
    const prisma = getPrisma() as any;
    const { page, pageSize } = normalizePage(params.page, params.pageSize);
    const where = buildLivroReceitaWhere(params);
    const sortDir = params.sortDir === "asc" ? "asc" : "desc";
    const orderBy =
      params.sortBy === "numeroReceita"
        ? [{ receita: { numeroReceita: sortDir } }, { id: "desc" }]
        : params.sortBy === "produtoNomeComercial"
          ? [{ dispensacao: { produto: { nomeComercial: sortDir } } }, { id: "desc" }]
          : params.sortBy === "clienteNome"
            ? [{ receita: { cliente: { nome: sortDir } } }, { id: "desc" }]
            : params.sortBy === "dataReceita"
              ? [{ receita: { dataReceita: sortDir } }, { id: "desc" }]
              : [{ createdAt: sortDir }, { id: "desc" }];

    const [rows, totalCount] = await Promise.all([
      prisma.livroReceita.findMany({
        where,
        include: livroReceitaInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
      prisma.livroReceita.count({ where }),
    ]);

    return {
      items: rows.slice(0, pageSize).map(mapLivroReceitaRow),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }
}

export class GetLivroReceitaDetailUseCase {
  async execute(entryId: string) {
    const prisma = getPrisma() as any;
    const id = BigInt(entryId);
    const row = await prisma.livroReceita.findUnique({
      where: { id },
      include: {
        ...livroReceitaInclude,
        dispensacao: {
          include: {
            user: { select: { id: true, name: true, role: true } },
            validadoPor: { select: { id: true, name: true, role: true } },
            produto: { include: { regulacao: true } },
            lote: true,
            fatura: true,
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundApiError("Movimento do livro de receitas não encontrado");
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: "LivroReceita", entityId: id },
          { entity: "Dispensacao", entityId: row.dispensacaoId },
          { entity: "Receita", entityId: row.receitaId },
        ],
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return {
      ...mapLivroReceitaRow(row),
      auditLogs: auditLogs.map((item: any) => ({
        id: item.id.toString(),
        action: item.action,
        entity: item.entity,
        createdAt: item.createdAt.toISOString(),
        user: item.user
          ? {
              id: item.user.id.toString(),
              name: item.user.name,
              role: item.user.role,
            }
          : null,
      })),
    };
  }
}
