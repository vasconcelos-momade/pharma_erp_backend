import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { NotFoundApiError } from "../../../../../shared/http/api-error";
import {
  normalizePage,
  parseDateRange,
  toNumber,
} from "./regulatory.helpers";

type ListLivroReceitasParams = {
  search?: string;
  clienteId?: string;
  produtoId?: string;
  responsavelId?: string;
  origem?: "FISICA" | "DIGITAL" | "SISTEMA_INTERNO";
  tipoMovimento?: "ENTRADA" | "SAIDA" | "CANCELAMENTO" | "AJUSTE";
  from?: string;
  to?: string;
  sortBy?: "createdAt" | "dataReceita" | "numeroReceita" | "produtoNome" | "clienteNome";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

function buildLivroReceitaWhere(params: ListLivroReceitasParams) {
  const { from, to } = parseDateRange(params.from, params.to);
  const search = params.search?.trim();

  return {
    ...(params.clienteId ? { clienteId: BigInt(params.clienteId) } : {}),
    ...(params.produtoId ? { produtoId: BigInt(params.produtoId) } : {}),
    ...(params.responsavelId ? { responsavelId: BigInt(params.responsavelId) } : {}),
    ...(params.origem ? { origemReceita: params.origem } : {}),
    ...(params.tipoMovimento ? { tipoMovimento: params.tipoMovimento } : {}),
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
            { numeroReceita: { contains: search } },
            { medicoNome: { contains: search } },
            { cliente: { nome: { contains: search } } },
            { produto: { nome: { contains: search } } },
            { lote: { numeroLote: { contains: search } } },
            { fatura: { numero: { contains: search } } },
          ],
        }
      : {}),
  };
}

function mapLivroReceitaRow(row: any) {
  return {
    id: row.id.toString(),
    receitaId: row.receitaId.toString(),
    clienteId: row.clienteId.toString(),
    produtoId: row.produtoId.toString(),
    loteId: row.loteId?.toString() ?? null,
    faturaId: row.faturaId?.toString() ?? null,
    faturaItemId: row.faturaItemId?.toString() ?? null,
    dispensacaoId: row.dispensacaoId?.toString() ?? null,
    tipoMovimento: row.tipoMovimento,
    quantidade: toNumber(row.quantidade),
    saldoAnterior: toNumber(row.saldoAnterior),
    saldoAtual: toNumber(row.saldoAtual),
    medicoNome: row.medicoNome,
    numeroReceita: row.numeroReceita,
    dataReceita: row.dataReceita.toISOString(),
    origemReceita: row.origemReceita,
    observacoes: row.observacoes,
    createdAt: row.createdAt.toISOString(),
    receita: row.receita
      ? {
          id: row.receita.id.toString(),
          numeroReceita: row.receita.numeroReceita,
          medicoNome: row.receita.medicoNome,
          unidadeSanitaria: row.receita.unidadeSanitaria,
        }
      : null,
    cliente: row.cliente
      ? {
          id: row.cliente.id.toString(),
          nome: row.cliente.nome,
          documento: row.cliente.documento,
        }
      : null,
    produto: row.produto
      ? {
          id: row.produto.id.toString(),
          nome: row.produto.nome,
          barcode: row.produto.barcode,
        }
      : null,
    lote: row.lote
      ? {
          id: row.lote.id.toString(),
          numeroLote: row.lote.numeroLote,
          dataValidade: row.lote.dataValidade?.toISOString?.() ?? null,
        }
      : null,
    responsavel: row.responsavel
      ? {
          id: row.responsavel.id.toString(),
          name: row.responsavel.name,
          role: row.responsavel.role,
        }
      : null,
    dispensacao: row.dispensacao
      ? {
          id: row.dispensacao.id.toString(),
          quantidade: toNumber(row.dispensacao.quantidade),
          tipoDispensacao: row.dispensacao.tipoDispensacao,
          createdAt: row.dispensacao.createdAt.toISOString(),
        }
      : null,
    fatura: row.fatura
      ? {
          id: row.fatura.id.toString(),
          numero: row.fatura.numero,
          total: toNumber(row.fatura.total),
          createdAt: row.fatura.createdAt?.toISOString?.() ?? null,
        }
      : null,
  };
}

export class LivroReceitasDashboardUseCase {
  async execute(params: Omit<ListLivroReceitasParams, "sortBy" | "sortDir" | "page" | "pageSize"> = {}) {
    const prisma = getPrisma() as any;
    const where = buildLivroReceitaWhere(params);

    const [totalMovimentos, entradas, saidas, pacientesUnicos, latest] =
      await Promise.all([
        prisma.livroReceita.count({ where }),
        prisma.livroReceita.count({
          where: { ...where, tipoMovimento: "ENTRADA" },
        }),
        prisma.livroReceita.count({
          where: { ...where, tipoMovimento: "SAIDA" },
        }),
        prisma.livroReceita.findMany({
          where,
          distinct: ["clienteId"],
          select: { clienteId: true },
        }),
        prisma.livroReceita.findMany({
          where,
          include: {
            cliente: { select: { id: true, nome: true, documento: true } },
            produto: { select: { id: true, nome: true, barcode: true } },
            lote: { select: { id: true, numeroLote: true, dataValidade: true } },
            responsavel: { select: { id: true, name: true, role: true } },
            dispensacao: { select: { id: true, quantidade: true, tipoDispensacao: true, createdAt: true } },
            fatura: { select: { id: true, numero: true, total: true, createdAt: true } },
            receita: { select: { id: true, numeroReceita: true, medicoNome: true, unidadeSanitaria: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

    return {
      kpis: {
        totalMovimentos,
        entradas,
        saidas,
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
        ? [{ numeroReceita: sortDir }, { id: "desc" }]
        : params.sortBy === "produtoNome"
          ? [{ produto: { nome: sortDir } }, { id: "desc" }]
          : params.sortBy === "clienteNome"
            ? [{ cliente: { nome: sortDir } }, { id: "desc" }]
            : params.sortBy === "dataReceita"
              ? [{ dataReceita: sortDir }, { id: "desc" }]
              : [{ createdAt: sortDir }, { id: "desc" }];

    const [rows, totalCount] = await Promise.all([
      prisma.livroReceita.findMany({
        where,
        include: {
          cliente: { select: { id: true, nome: true, documento: true } },
          produto: { select: { id: true, nome: true, barcode: true } },
          lote: { select: { id: true, numeroLote: true, dataValidade: true } },
          responsavel: { select: { id: true, name: true, role: true } },
          dispensacao: { select: { id: true, quantidade: true, tipoDispensacao: true, createdAt: true } },
          fatura: { select: { id: true, numero: true, total: true, createdAt: true } },
          receita: { select: { id: true, numeroReceita: true, medicoNome: true, unidadeSanitaria: true } },
        },
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
        cliente: true,
        produto: {
          include: {
            regulacao: true,
          },
        },
        lote: true,
        responsavel: true,
        dispensacao: {
          include: {
            user: { select: { id: true, name: true, role: true } },
            validadoPor: { select: { id: true, name: true, role: true } },
            fatura: { select: { id: true, numero: true, total: true, createdAt: true } },
          },
        },
        fatura: true,
        receita: true,
      },
    });

    if (!row) {
      throw new NotFoundApiError("Movimento do livro de receitas não encontrado");
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: "LivroReceita", entityId: id },
          row.dispensacaoId
            ? { entity: "Dispensacao", entityId: row.dispensacaoId }
            : undefined,
          { entity: "Receita", entityId: row.receitaId },
        ].filter(Boolean),
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
