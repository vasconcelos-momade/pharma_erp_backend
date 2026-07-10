import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { NotFoundApiError } from "../../../../../shared/http/api-error";
import { resolveRegulacaoPolicyForProduto } from "../../../products/domain/produto-presenter";
import {
  normalizePage,
  parseDateRange,
  toNumber,
} from "./regulatory.helpers";

type SanitarioDashboardParams = {
  search?: string;
  from?: string;
  to?: string;
};

type ListSanitarioParams = {
  search?: string;
  estado?: "VALIDO" | "EXPIRADO" | "RECALL" | "QUARENTENA" | "BLOQUEADO" | "CRITICO";
  alertaTipo?:
    | "ESTOQUE_BAIXO"
    | "PRODUTO_ESGOTADO"
    | "LOTE_EXPIRADO"
    | "LOTE_A_EXPIRAR"
    | "PRECO_SUBIU"
    | "SEM_FORNECEDOR";
  produtoId?: string;
  sortBy?: "dataValidade" | "produtoNomeComercial" | "quantidadeAtual" | "quantidadeTotal" | "quantidadeDisponivel" | "estadoSanitario";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

type ListSanitarioReportsParams = {
  tipo?:
    | "MAPA_MENSAL_PSICOTROPICOS"
    | "MAPA_MENSAL_NARCOTICOS"
    | "RELATORIO_EXPIRADOS"
    | "RELATORIO_QUARENTENA"
    | "RELATORIO_INCINERACAO"
    | "BALANCO_ESTOQUE_ANUAL";
  page?: number;
  pageSize?: number;
};

function buildSanitarioSearchWhere(params: SanitarioDashboardParams) {
  const { from, to } = parseDateRange(params.from, params.to);
  const search = params.search?.trim();
  return {
    deletedAt: null,
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
            { numeroLote: { contains: search } },
            { produto: { nomeComercial: { contains: search } } },
            { produto: { barcode: { contains: search } } },
          ],
        }
      : {}),
  };
}

function readLoteStock(row: any) {
  return {
    quantidadeTotal: toNumber(row.stockBalance?.quantidadeTotal ?? row.quantidadeAtual),
    quantidadeDisponivel: toNumber(row.stockBalance?.quantidadeDisponivel ?? row.quantidadeAtual),
  };
}

function mapRegulacaoSummary(produto: any) {
  if (!produto?.regulacao) {
    return null;
  }
  const policy = resolveRegulacaoPolicyForProduto({
    regulacao: produto.regulacao,
    categoria: produto.categoria ?? null,
  });
  return {
    tipoDispensacao: policy.tipoDispensacao,
    riskLevel: policy.riskLevel,
    requiresManualReview: policy.requiresManualReview,
  };
}

function mapSanitarioRow(row: any, latestAlert: any) {
  const { quantidadeTotal, quantidadeDisponivel } = readLoteStock(row);
  const criticalStock =
    quantidadeDisponivel <= Number(row.produto?.estoqueMinimo ?? 0);
  const hasQuarantine = Number(row.quantidadeQuarentena ?? 0) > 0;
  const status =
    row.estadoSanitario === "EXPIRADO"
      ? "EXPIRADO"
      : row.estadoSanitario === "RECALL"
        ? "RECALL"
        : hasQuarantine
          ? "QUARENTENA"
          : row.disponibilidade === "BLOQUEADO"
            ? "BLOQUEADO"
            : criticalStock
              ? "CRITICO"
              : row.estadoSanitario;

  return {
    id: row.id.toString(),
    produtoId: row.produtoId.toString(),
    numeroLote: row.numeroLote,
    dataValidade: row.dataValidade.toISOString(),
    quantidadeTotal,
    quantidadeDisponivel,
    quantidadeQuarentena: toNumber(row.quantidadeQuarentena),
    quantidadeIncinerada: toNumber(row.quantidadeIncinerada),
    estadoSanitario: row.estadoSanitario,
    disponibilidade: row.disponibilidade,
    status,
    produto: row.produto
      ? {
          id: row.produto.id.toString(),
          nome: row.produto.nomeComercial,
          barcode: row.produto.barcode,
          estoqueMinimo: toNumber(row.produto.estoqueMinimo),
          regulacao: mapRegulacaoSummary(row.produto),
        }
      : null,
    latestAlert: latestAlert
      ? {
          id: latestAlert.id.toString(),
          tipo: latestAlert.tipo,
          mensagem: latestAlert.mensagem,
          resolvido: latestAlert.resolvido,
          createdAt: latestAlert.createdAt.toISOString(),
        }
      : null,
  };
}

export class SanitarioDashboardUseCase {
  async execute(params: SanitarioDashboardParams = {}) {
    const prisma = getPrisma() as any;
    const now = new Date();
    const next30Days = new Date(now);
    next30Days.setDate(next30Days.getDate() + 30);
    const loteWhere = buildSanitarioSearchWhere(params);

    const [expirados, proximosValidade, recall, quarentena, incineracoes, stockCriticoRows, alertasSanitarios, latest] =
      await Promise.all([
        prisma.lote.count({
          where: {
            ...loteWhere,
            dataValidade: { lt: now },
          },
        }),
        prisma.lote.count({
          where: {
            ...loteWhere,
            dataValidade: { gte: now, lte: next30Days },
          },
        }),
        prisma.lote.count({
          where: {
            ...loteWhere,
            estadoSanitario: "RECALL",
          },
        }),
        prisma.lote.count({
          where: {
            ...loteWhere,
            quantidadeQuarentena: { gt: 0 },
          },
        }),
        prisma.incineracao.count({}),
        prisma.lote.findMany({
          where: {
            ...loteWhere,
            produto: {
              estoqueMinimo: { gt: 0 },
            },
          },
          select: {
            stockBalance: {
              select: {
                quantidadeTotal: true,
                quantidadeDisponivel: true,
              },
            },
            produto: {
              select: {
                estoqueMinimo: true,
              },
            },
          },
        }),
        prisma.alertaEstoque.count({
          where: {
            resolvido: false,
            ...(params.search?.trim()
              ? {
                  produto: {
                    nomeComercial: { contains: params.search.trim() },
                  },
                }
              : {}),
          },
        }),
        prisma.lote.findMany({
          where: {
            ...loteWhere,
            OR: [
              { dataValidade: { lt: next30Days } },
              { estadoSanitario: { in: ["RECALL", "EXPIRADO"] } },
              { quantidadeQuarentena: { gt: 0 } },
              { disponibilidade: "BLOQUEADO" },
            ],
          },
          include: {
            produto: {
              select: {
                id: true,
                nomeComercial: true,
                barcode: true,
                estoqueMinimo: true,
                regulacao: {
                  select: { tipoDispensacao: true },
                },
                categoria: {
                  select: { id: true, nome: true, codigoFNM: true },
                },
              },
            },
            stockBalance: {
              select: {
                quantidadeTotal: true,
                quantidadeDisponivel: true,
              },
            },
          },
          orderBy: [{ dataValidade: "asc" }, { id: "desc" }],
          take: 5,
        }),
      ]);

    const latestAlerts = latest.length
      ? await prisma.alertaEstoque.findMany({
          where: {
            produtoId: { in: latest.map((item: any) => item.produtoId) },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    const alertMap = new Map<string, any>();
    for (const alert of latestAlerts) {
      const key = alert.produtoId.toString();
      if (!alertMap.has(key)) {
        alertMap.set(key, alert);
      }
    }

    const stockCritico = stockCriticoRows.filter(
      (item: any) => {
        const { quantidadeDisponivel } = readLoteStock(item);
        return (
          Number(item.produto?.estoqueMinimo ?? 0) > 0 &&
          quantidadeDisponivel <= Number(item.produto?.estoqueMinimo ?? 0)
        );
      },
    ).length;

    return {
      kpis: {
        expirados,
        proximosValidade,
        recall,
        quarentena,
        incineracoes,
        stockCritico,
        alertasSanitarios,
      },
      latest: latest.map((row: any) =>
        mapSanitarioRow(row, alertMap.get(row.produtoId.toString())),
      ),
    };
  }
}

export class ListSanitarioUseCase {
  async execute(params: ListSanitarioParams = {}) {
    const prisma = getPrisma() as any;
    const { page, pageSize } = normalizePage(params.page, params.pageSize);
    const searchWhere = buildSanitarioSearchWhere({ search: params.search });
    const sortDir = params.sortDir === "asc" ? "asc" : "desc";

    const where: Record<string, unknown> = {
      ...searchWhere,
      ...(params.produtoId ? { produtoId: BigInt(params.produtoId) } : {}),
      ...(params.alertaTipo
        ? {
            produto: {
              alertasEstoque: {
                some: {
                  tipo: params.alertaTipo,
                },
              },
            },
          }
        : {}),
    };

    if (params.estado === "QUARENTENA") {
      where.quantidadeQuarentena = { gt: 0 };
    } else if (params.estado === "BLOQUEADO") {
      where.disponibilidade = "BLOQUEADO";
    } else if (params.estado === "CRITICO") {
      // handled after fetch because depends on produto.estoqueMinimo
    } else if (params.estado) {
      where.estadoSanitario = params.estado;
    }

    const orderBy =
      params.sortBy === "produtoNomeComercial"
        ? [{ produto: { nomeComercial: sortDir } }, { id: "desc" }]
        : params.sortBy === "quantidadeAtual" ||
            params.sortBy === "quantidadeTotal"
          ? [{ stockBalance: { quantidadeTotal: sortDir } }, { id: "desc" }]
          : params.sortBy === "quantidadeDisponivel"
            ? [{ stockBalance: { quantidadeDisponivel: sortDir } }, { id: "desc" }]
            : params.sortBy === "estadoSanitario"
              ? [{ estadoSanitario: sortDir }, { id: "desc" }]
              : [{ dataValidade: sortDir }, { id: "desc" }];

    const requiresInMemoryPagination = params.estado === "CRITICO";

    const rows = await prisma.lote.findMany({
      where,
      include: {
        produto: {
          select: {
            id: true,
            nomeComercial: true,
            barcode: true,
            estoqueMinimo: true,
            regulacao: {
              select: { tipoDispensacao: true },
            },
            categoria: {
              select: { id: true, nome: true, codigoFNM: true },
            },
          },
        },
        stockBalance: {
          select: {
            quantidadeTotal: true,
            quantidadeDisponivel: true,
          },
        },
      },
      orderBy,
      ...(requiresInMemoryPagination
        ? {}
        : {
            skip: (page - 1) * pageSize,
            take: pageSize + 1,
          }),
    });

    const produtoIds = [...new Set(rows.map((item: any) => item.produtoId))];
    const latestAlerts = produtoIds.length
      ? await prisma.alertaEstoque.findMany({
          where: {
            produtoId: { in: produtoIds },
            ...(params.alertaTipo ? { tipo: params.alertaTipo } : {}),
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    const alertMap = new Map<string, any>();
    for (const alert of latestAlerts) {
      const key = alert.produtoId.toString();
      if (!alertMap.has(key)) {
        alertMap.set(key, alert);
      }
    }

    const mapped = rows
      .map((row: any) => mapSanitarioRow(row, alertMap.get(row.produtoId.toString())))
      .filter((item: any) => {
        if (params.estado && item.status !== params.estado) return false;
        return true;
      });

    const totalCount = requiresInMemoryPagination
      ? mapped.length
      : await prisma.lote.count({ where });

    const paginated = requiresInMemoryPagination
      ? mapped.slice((page - 1) * pageSize, page * pageSize)
      : mapped.slice(0, pageSize);

    return {
      items: paginated,
      page,
      pageSize,
      hasMore: requiresInMemoryPagination
          ? page * pageSize < mapped.length
          : rows.length > pageSize,
      totalCount,
    };
  }
}

export class GetLoteSanitarioHistoryUseCase {
  async execute(loteId: string) {
    const prisma = getPrisma() as any;
    const id = BigInt(loteId);
    const lote = await prisma.lote.findUnique({
      where: { id },
      include: {
        produto: {
          include: {
            regulacao: true,
            categoria: {
              select: { id: true, nome: true, codigoFNM: true },
            },
          },
        },
        stockBalance: {
          select: {
            quantidadeTotal: true,
            quantidadeDisponivel: true,
          },
        },
      },
    });

    if (!lote) {
      throw new NotFoundApiError("Lote não encontrado");
    }

    const [movimentos, incineracoes, businessEvents] = await Promise.all([
      prisma.loteMovimentoSanitario.findMany({
        where: { loteId: id },
        include: {
          responsavel: {
            select: { id: true, name: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.incineracaoItem.findMany({
        where: { loteId: id },
        include: {
          incineracao: {
            include: {
              responsavel: { select: { id: true, name: true, role: true } },
              aprovadoPor: { select: { id: true, name: true, role: true } },
            },
          },
        },
        orderBy: { incineracao: { dataIncineracao: "desc" } },
      }),
      prisma.businessEvent.findMany({
        where: {
          OR: [
            { entity: "Lote", entityId: id },
            { entity: "Incineracao", entityId: { in: [] } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    const { quantidadeTotal, quantidadeDisponivel } = readLoteStock(lote);

    return {
      lote: {
        id: lote.id.toString(),
        numeroLote: lote.numeroLote,
        dataValidade: lote.dataValidade.toISOString(),
        quantidadeTotal,
        quantidadeDisponivel,
        quantidadeQuarentena: toNumber(lote.quantidadeQuarentena),
        quantidadeIncinerada: toNumber(lote.quantidadeIncinerada),
        estadoSanitario: lote.estadoSanitario,
        disponibilidade: lote.disponibilidade,
        produto: {
          id: lote.produto.id.toString(),
          nome: lote.produto.nomeComercial,
          barcode: lote.produto.barcode,
          regulacao: mapRegulacaoSummary(lote.produto),
        },
      },
      movimentos: movimentos.map((item: any) => ({
        id: item.id.toString(),
        tipo: item.tipo,
        quantidade: toNumber(item.quantidade),
        motivo: item.motivo,
        documentoReferencia: item.documentoReferencia,
        createdAt: item.createdAt.toISOString(),
        responsavel: item.responsavel
          ? {
              id: item.responsavel.id.toString(),
              name: item.responsavel.name,
              role: item.responsavel.role,
            }
          : null,
      })),
      incineracoes: incineracoes.map((item: any) => ({
        id: item.id.toString(),
        quantidade: toNumber(item.quantidade),
        motivo: item.motivo,
        incineracao: {
          id: item.incineracao.id.toString(),
          numeroAuto: item.incineracao.numeroAuto,
          dataIncineracao: item.incineracao.dataIncineracao.toISOString(),
          entidadeDestino: item.incineracao.entidadeDestino,
          observacoes: item.incineracao.observacoes,
          responsavel: item.incineracao.responsavel
            ? {
                id: item.incineracao.responsavel.id.toString(),
                name: item.incineracao.responsavel.name,
                role: item.incineracao.responsavel.role,
              }
            : null,
          aprovadoPor: item.incineracao.aprovadoPor
            ? {
                id: item.incineracao.aprovadoPor.id.toString(),
                name: item.incineracao.aprovadoPor.name,
                role: item.incineracao.aprovadoPor.role,
              }
            : null,
        },
      })),
      businessEvents: businessEvents.map((item: any) => ({
        id: item.id.toString(),
        type: item.type,
        entity: item.entity,
        entityId: item.entityId?.toString() ?? null,
        payload: item.payload,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }
}

export class ListSanitarioReportsUseCase {
  async execute(params: ListSanitarioReportsParams = {}) {
    const prisma = getPrisma() as any;
    const { page, pageSize } = normalizePage(params.page, params.pageSize);
    const where = params.tipo ? { tipo: params.tipo } : undefined;

    const [rows, totalCount] = await Promise.all([
      prisma.sanitarioReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
      prisma.sanitarioReport.count({ where }),
    ]);

    return {
      items: rows.slice(0, pageSize).map((row: any) => ({
        id: row.id.toString(),
        tipo: row.tipo,
        periodo: row.periodo,
        arquivoUrl: row.arquivoUrl,
        payload: row.payload,
        geradoPorId: row.geradoPorId?.toString?.() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }
}
