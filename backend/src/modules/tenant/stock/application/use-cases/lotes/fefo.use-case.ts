import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  FEFO_LOTE_FILTER,
  findFefoLote,
  loteQuantidadeDisponivel,
} from "../../../domain/fefo-lote.service";
import { mapLoteListItem } from "./lote.mapper";

export class FefoDashboardUseCase {
  async execute() {
    const prisma = getPrisma() as any;
    const now = new Date();

    const [lotesExpirados, lotesBloqueados, produtosComMultiplosLotes] =
      await prisma.$transaction([
        prisma.lote.count({
          where: {
            deletedAt: null,
            ativo: true,
            quantidadeAtual: { gt: 0 },
            dataValidade: { lt: now },
          },
        }),
        prisma.lote.count({
          where: {
            deletedAt: null,
            ativo: true,
            OR: [
              { estadoSanitario: { not: "VALIDO" } },
              { disponibilidade: { not: "DISPONIVEL" } },
            ],
          },
        }),
        prisma.lote.groupBy({
          by: ["produtoId"],
          where: {
            ...FEFO_LOTE_FILTER,
            dataValidade: { gt: now },
            quantidadeAtual: { gt: 0 },
          },
          _count: { _all: true },
          having: { produtoId: { _count: { gt: 1 } } },
        }),
      ]);

    return {
      produtosForaFefo: produtosComMultiplosLotes.length,
      lotesExpirados,
      lotesBloqueados,
      alertasFefo: lotesExpirados + lotesBloqueados,
    };
  }
}

export class SearchFefoOverviewUseCase {
  async execute(params: {
    q?: string;
    produtoId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const prisma = getPrisma() as any;
    const now = new Date();
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

    const produtoWhere: Record<string, unknown> = {
      deletedAt: null,
      ativo: true,
      lotes: {
        some: {
          ...FEFO_LOTE_FILTER,
          dataValidade: { gt: now },
          quantidadeAtual: { gt: 0 },
        },
      },
    };

    if (params.produtoId) produtoWhere.id = BigInt(params.produtoId);
    const q = params.q?.trim();
    if (q) {
      produtoWhere.OR = [
        { nome: { contains: q } },
        { barcode: { contains: q } },
      ];
    }

    const produtos = await prisma.produto.findMany({
      where: produtoWhere,
      select: { id: true, nome: true, barcode: true },
      orderBy: { nome: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });

    const items = [];
    for (const produto of produtos.slice(0, pageSize)) {
      const recomendado = await findFefoLote(prisma, produto.id);
      const lotes = await prisma.lote.findMany({
        where: {
          produtoId: produto.id,
          deletedAt: null,
          ativo: true,
          quantidadeAtual: { gt: 0 },
        },
        include: {
          produto: { select: { nome: true } },
          fornecedor: { select: { nome: true } },
        },
        orderBy: { dataValidade: "asc" },
      });

      const violacao = lotes.some(
        (lote: any) =>
          recomendado &&
          lote.id !== recomendado.id &&
          loteQuantidadeDisponivel(lote) > 0 &&
          new Date(lote.dataValidade).getTime() >
            new Date(recomendado.dataValidade).getTime(),
      );

      items.push({
        produtoId: produto.id.toString(),
        produtoNome: produto.nome,
        produtoBarcode: produto.barcode ?? null,
        loteRecomendado: recomendado
          ? {
              id: recomendado.id.toString(),
              numeroLote: recomendado.numeroLote,
              dataValidade: recomendado.dataValidade.toISOString(),
              stock: loteQuantidadeDisponivel(recomendado),
            }
          : null,
        situacao: !recomendado
          ? "SEM_LOTE_FEFO"
          : violacao
            ? "VIOLACAO_FEFO"
            : "CONFORME_FEFO",
        totalLotesComStock: lotes.length,
      });
    }

    const totalCount = await prisma.produto.count({ where: produtoWhere });

    return {
      items,
      page,
      pageSize,
      hasMore: produtos.length > pageSize,
      totalCount,
    };
  }
}

export class SearchFefoAuditUseCase {
  async execute(params: {
    q?: string;
    produtoId?: string;
    situacao?: string;
    page?: number;
    pageSize?: number;
  }) {
    const prisma = getPrisma() as any;
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

    const where: Record<string, unknown> = {
      loteId: { not: null },
    };

    if (params.produtoId) where.produtoId = BigInt(params.produtoId);

    const q = params.q?.trim();
    if (q) {
      where.OR = [
        { produto: { nome: { contains: q } } },
        { lote: { numeroLote: { contains: q } } },
        { fatura: { user: { name: { contains: q } } } },
      ];
    }

    const filterMap: Record<string, string> = {
      CONFORME: "CONFORME",
      VIOLACAO: "VIOLACAO_FEFO",
      EXPIRADO: "LOTE_EXPIRADO",
      QUARENTENA: "QUARENTENA",
    };
    const situacaoEsperada = params.situacao
      ? filterMap[params.situacao]
      : undefined;

    const items: Array<Record<string, unknown>> = [];
    let skip = (page - 1) * pageSize;
    const batchSize = situacaoEsperada ? pageSize * 5 : pageSize + 1;
    let hasMore = false;

    while (items.length <= pageSize) {
      const rows = await prisma.faturaItem.findMany({
        where,
        include: {
          produto: { select: { id: true, nome: true } },
          lote: {
            select: {
              id: true,
              numeroLote: true,
              dataValidade: true,
              estadoSanitario: true,
              disponibilidade: true,
              quantidadeAtual: true,
              quantidadeQuarentena: true,
            },
          },
          fatura: {
            select: {
              id: true,
              numero: true,
              createdAt: true,
              user: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { fatura: { createdAt: "desc" } },
        skip,
        take: batchSize,
      });

      if (rows.length === 0) {
        break;
      }

      skip += rows.length;

      for (const row of rows) {
        if (!row.lote || !row.produto) continue;

        const recomendado = await findFefoLote(prisma, row.produto.id);
        const now = new Date();
        let situacao: string = "CONFORME";
        let motivo = "Lote utilizado conforme FEFO";

        if (new Date(row.lote.dataValidade) < now) {
          situacao = "LOTE_EXPIRADO";
          motivo = "Lote expirado no momento da consulta";
        } else if (
          row.lote.estadoSanitario !== "VALIDO" ||
          row.lote.disponibilidade !== "DISPONIVEL"
        ) {
          situacao = "QUARENTENA";
          motivo = `Estado ${row.lote.estadoSanitario} / ${row.lote.disponibilidade}`;
        } else if (recomendado && row.lote.id !== recomendado.id) {
          situacao = "VIOLACAO_FEFO";
          motivo = `Lote correcto FEFO: ${recomendado.numeroLote}`;
        }

        if (situacaoEsperada && situacaoEsperada !== situacao) {
          continue;
        }

        items.push({
          id: row.id.toString(),
          produtoId: row.produto.id.toString(),
          produtoNome: row.produto.nome,
          loteUtilizado: {
            id: row.lote.id.toString(),
            numeroLote: row.lote.numeroLote,
            dataValidade: row.lote.dataValidade.toISOString(),
          },
          loteCorreto: recomendado
            ? {
                id: recomendado.id.toString(),
                numeroLote: recomendado.numeroLote,
                dataValidade: recomendado.dataValidade.toISOString(),
              }
            : null,
          utilizador: row.fatura?.user
            ? {
                id: row.fatura.user.id.toString(),
                nome: row.fatura.user.name,
              }
            : null,
          data: row.fatura?.createdAt?.toISOString() ?? null,
          motivo,
          situacao,
          documento: row.fatura?.numero ?? null,
        });

        if (items.length > pageSize) {
          hasMore = true;
          break;
        }
      }

      if (items.length > pageSize || rows.length < batchSize) {
        if (rows.length >= batchSize && items.length <= pageSize) {
          hasMore = true;
        }
        break;
      }
    }

    return {
      items: items.slice(0, pageSize),
      page,
      pageSize,
      hasMore,
      totalCount: undefined,
    };
  }
}
