import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { NotFoundApiError } from "../../../../../shared/http/api-error";
import { resolveRegulacaoPolicyForProduto } from "../../../products/domain/produto-presenter";
import {
  normalizePage,
  parseDateRange,
  toNumber,
} from "./regulatory.helpers";

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
    ...(params.produtoId ? { produtoId: BigInt(params.produtoId) } : {}),
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
            { produto: { nomeComercial: { contains: search } } },
            { lote: { numeroLote: { contains: search } } },
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
  return {
    id: row.id.toString(),
    produtoId: row.produtoId.toString(),
    loteId: row.loteId?.toString() ?? null,
    dispensacaoId: row.dispensacaoId?.toString() ?? null,
    responsavelId: row.responsavelId.toString(),
    tipoMovimento: row.tipoMovimento,
    quantidade: toNumber(row.quantidade),
    saldoAnterior: toNumber(row.saldoAnterior),
    saldoAtual: toNumber(row.saldoAtual),
    numeroDocumento: row.numeroDocumento,
    observacoes: row.observacoes,
    createdAt: row.createdAt.toISOString(),
    produto: row.produto
      ? {
          id: row.produto.id.toString(),
          nome: row.produto.nomeComercial,
          barcode: row.produto.barcode,
          regulacao: mapLivroRegulacaoSummary(row.produto),
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
          where,
          distinct: ["produtoId"],
          select: { produtoId: true },
        }),
        prisma.livroPsicotropico.findMany({
          where,
          include: {
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
            responsavel: { select: { id: true, name: true, role: true } },
            dispensacao: { select: { id: true, quantidade: true, tipoDispensacao: true, createdAt: true } },
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
        produtosMonitorados: produtosMonitorados.length,
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
          ? [{ produto: { nomeComercial: sortDir } }, { id: "desc" }]
          : params.sortBy === "quantidade"
            ? [{ quantidade: sortDir }, { id: "desc" }]
            : [{ createdAt: sortDir }, { id: "desc" }];

    const [rows, totalCount] = await Promise.all([
      prisma.livroPsicotropico.findMany({
        where,
        include: {
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
          responsavel: { select: { id: true, name: true, role: true } },
          dispensacao: { select: { id: true, quantidade: true, tipoDispensacao: true, createdAt: true } },
        },
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
        produto: {
          include: {
            regulacao: true,
          },
        },
        lote: true,
        responsavel: true,
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
