import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { NotFoundApiError } from "../../../../../shared/http/api-error";
import { resolveRegulacaoPolicyForProduto } from "../../../products/domain/produto-presenter";
import {
  normalizePage,
  parseDateRange,
  toNumber,
} from "./regulatory.helpers";

const livroPsicotropicoInclude = {
  responsavel: { select: { id: true, name: true, role: true } },
  dispensacao: {
    select: {
      id: true,
      produtoId: true,
      loteId: true,
      quantidade: true,
      tipoDispensacao: true,
      createdAt: true,
      produto: {
        select: {
          id: true,
          nomeComercial: true,
          barcode: true,
          regulacao: {
            select: {
              tipoDispensacao: true,
              requiresPrescription: true,
              requiresPsychotropicBook: true,
            },
          },
          categoria: {
            select: { id: true, nome: true, codigoFNM: true },
          },
        },
      },
      lote: { select: { id: true, numeroLote: true, dataValidade: true } },
    },
  },
} as const;

type ListLivroPsicotropicosParams = {
  search?: string;
  produtoId?: string;
  responsavelId?: string;
  tipoMovimento?: "ENTRADA" | "SAIDA" | "IMPORTACAO";
  from?: string;
  to?: string;
  sortBy?: "createdAt" | "numeroDocumento" | "produtoNomeComercial" | "quantidade";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

function buildLivroPsicotropicoWhere(params: ListLivroPsicotropicosParams) {
  const { from, to } = parseDateRange(params.from, params.to);
  const search = params.search?.trim();

  return {
    ...(params.produtoId
      ? { dispensacao: { produtoId: BigInt(params.produtoId) } }
      : {}),
    ...(params.responsavelId ? { responsavelId: BigInt(params.responsavelId) } : {}),
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
            { numeroDocumento: { contains: search } },
            { observacoes: { contains: search } },
            { dispensacao: { produto: { nomeComercial: { contains: search } } } },
            { dispensacao: { lote: { numeroLote: { contains: search } } } },
            { responsavel: { name: { contains: search } } },
          ],
        }
      : {}),
  };
}

function mapLivroRegulacaoSummary(produto: any) {
  if (!produto?.regulacao) {
    return null;
  }
  const policy = resolveRegulacaoPolicyForProduto({
    regulacao: produto.regulacao,
    categoria: produto.categoria ?? null,
  });
  return {
    tipoDispensacao: policy.tipoDispensacao,
    requiresPsychotropicBook:
      produto.regulacao.requiresPsychotropicBook ?? policy.requiresPsychotropicBook,
    riskLevel: policy.riskLevel,
  };
}

function mapLivroPsicotropicoRow(row: any) {
  const dispensacao = row.dispensacao;
  const produto = dispensacao?.produto;
  const lote = dispensacao?.lote;

  return {
    id: row.id.toString(),
    produtoId: dispensacao?.produtoId?.toString() ?? null,
    loteId: dispensacao?.loteId?.toString() ?? null,
    dispensacaoId: row.dispensacaoId?.toString() ?? null,
    responsavelId: row.responsavelId.toString(),
    tipoMovimento: row.tipoMovimento,
    quantidade: toNumber(dispensacao?.quantidade),
    saldoAnterior: null,
    saldoAtual: null,
    numeroDocumento: row.numeroDocumento,
    observacoes: row.observacoes,
    createdAt: row.createdAt.toISOString(),
    produto: produto
      ? {
          id: produto.id.toString(),
          nome: produto.nomeComercial,
          barcode: produto.barcode,
          regulacao: mapLivroRegulacaoSummary(produto),
        }
      : null,
    lote: lote
      ? {
          id: lote.id.toString(),
          numeroLote: lote.numeroLote,
          dataValidade: lote.dataValidade?.toISOString?.() ?? null,
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
  };
}

export class LivroPsicotropicosDashboardUseCase {
  async execute(params: Omit<ListLivroPsicotropicosParams, "sortBy" | "sortDir" | "page" | "pageSize"> = {}) {
    const prisma = getPrisma() as any;
    const where = buildLivroPsicotropicoWhere(params);

    const [totalMovimentos, entradas, saidas, produtosMonitorados, latest] =
      await Promise.all([
        prisma.livroPsicotropico.count({ where }),
        prisma.livroPsicotropico.count({
          where: { ...where, tipoMovimento: "ENTRADA" },
        }),
        prisma.livroPsicotropico.count({
          where: { ...where, tipoMovimento: "SAIDA" },
        }),
        prisma.livroPsicotropico.findMany({
          where: {
            ...where,
            dispensacaoId: { not: null },
          },
          distinct: ["dispensacaoId"],
          select: { dispensacao: { select: { produtoId: true } } },
        }),
        prisma.livroPsicotropico.findMany({
          where,
          include: livroPsicotropicoInclude,
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

    const uniqueProdutos = new Set(
      produtosMonitorados
        .map((row: any) => row.dispensacao?.produtoId?.toString())
        .filter(Boolean),
    );

    return {
      kpis: {
        totalMovimentos,
        entradas,
        saidas,
        produtosMonitorados: uniqueProdutos.size,
      },
      latest: latest.map(mapLivroPsicotropicoRow),
    };
  }
}

export class ListLivroPsicotropicosUseCase {
  async execute(params: ListLivroPsicotropicosParams = {}) {
    const prisma = getPrisma() as any;
    const { page, pageSize } = normalizePage(params.page, params.pageSize);
    const where = buildLivroPsicotropicoWhere(params);
    const sortDir = params.sortDir === "asc" ? "asc" : "desc";
    const orderBy =
      params.sortBy === "numeroDocumento"
        ? [{ numeroDocumento: sortDir }, { id: "desc" }]
        : params.sortBy === "produtoNomeComercial"
          ? [{ dispensacao: { produto: { nomeComercial: sortDir } } }, { id: "desc" }]
          : params.sortBy === "quantidade"
            ? [{ dispensacao: { quantidade: sortDir } }, { id: "desc" }]
            : [{ createdAt: sortDir }, { id: "desc" }];

    const [rows, totalCount] = await Promise.all([
      prisma.livroPsicotropico.findMany({
        where,
        include: livroPsicotropicoInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
      prisma.livroPsicotropico.count({ where }),
    ]);

    return {
      items: rows.slice(0, pageSize).map(mapLivroPsicotropicoRow),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }
}

export class GetLivroPsicotropicoDetailUseCase {
  async execute(entryId: string) {
    const prisma = getPrisma() as any;
    const id = BigInt(entryId);
    const row = await prisma.livroPsicotropico.findUnique({
      where: { id },
      include: {
        ...livroPsicotropicoInclude,
        dispensacao: {
          include: {
            receita: {
              select: {
                id: true,
                numeroReceita: true,
                medicoNome: true,
              },
            },
            user: { select: { id: true, name: true, role: true } },
            validadoPor: { select: { id: true, name: true, role: true } },
            fatura: { select: { id: true, numero: true, total: true, createdAt: true } },
            produto: { include: { regulacao: true } },
            lote: true,
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundApiError("Movimento do livro de psicotrópicos não encontrado");
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: "LivroPsicotropico", entityId: id },
          row.dispensacaoId
            ? { entity: "Dispensacao", entityId: row.dispensacaoId }
            : undefined,
        ].filter(Boolean),
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return {
      ...mapLivroPsicotropicoRow(row),
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
