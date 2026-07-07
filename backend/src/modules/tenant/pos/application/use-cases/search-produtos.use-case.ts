import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { FEFO_LOTE_FILTER } from "../../../stock/domain/fefo-lote.service";
import { startOfUtcDay } from "../../../stock/domain/expiry-date.util";
import { getLoteQuantidadeDisponivel } from "../../../stock/domain/lote-stock.service";
import {
  mapPosProduto,
  produtoPosSelect,
} from "../../../products/domain/produto-presenter";

export class SearchProdutosUseCase {
  async execute(params?: {
    query?: string;
    barcode?: string;
    categoriaId?: bigint;
    page?: number;
    pageSize?: number;
  }) {
    const prisma = getPrisma() as any;
    const query = params?.query?.trim() || undefined;
    const barcode = params?.barcode?.trim() || undefined;
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 20));

    // Importante: não dependemos do cache `lote_stock_balances` para listar no PDV.
    // A fonte de verdade é `estoque_movimentos` (ver `lote-stock.service.ts`).
    const loteWhereBase = {
      ...FEFO_LOTE_FILTER,
      dataValidade: { gte: startOfUtcDay(new Date()) },
      produto: {
        is: {
          ativo: true,
          deletedAt: null,
          ...(params?.categoriaId ? { categoriaId: params.categoriaId } : {}),
        },
      },
    } as const;

    if (barcode) {
      // Barcode no POS deve respeitar stock/lote válido.
      const lotes = await prisma.lote.findMany({
        where: {
          ...loteWhereBase,
          produto: { is: { ...loteWhereBase.produto.is, barcode } },
        },
        orderBy: [{ dataValidade: "asc" }, { createdAt: "asc" }],
        take: 50,
        select: {
          id: true,
          numeroLote: true,
          dataValidade: true,
          precoVenda: true,
          quantidadeQuarentena: true,
          produto: { select: produtoPosSelect },
        },
      });

      if (!lotes.length) {
        return { items: [], page: 1, pageSize: 1, hasMore: false };
      }

      // Filtra por stock vendável (movimentos − quarentena), FEFO já está no orderBy.
      const eligible: any[] = [];
      for (const lote of lotes) {
        const disponivel = await getLoteQuantidadeDisponivel(prisma, lote);
        if (disponivel > 0) {
          eligible.push({ ...lote, _disponivel: disponivel });
        }
      }
      if (!eligible.length) {
        return { items: [], page: 1, pageSize: 1, hasMore: false };
      }

      const first = eligible[0];
      const sumDisponivel = eligible.reduce((sum, l) => sum + l._disponivel, 0);

      const produto = {
        ...(first.produto as Record<string, unknown>),
        stockBalance: { quantidadeDisponivel: sumDisponivel },
        lotes: eligible.slice(0, 3).map((l: any) => ({
          id: l.id,
          numeroLote: l.numeroLote,
          dataValidade: l.dataValidade,
          precoVenda: l.precoVenda,
          stockBalance: { quantidadeDisponivel: l._disponivel },
        })),
      };

      return {
        items: [mapPosProduto(produto as Record<string, unknown>)],
        page: 1,
        pageSize: 1,
        hasMore: false,
      };
    }

    const queryFilters = query
      ? {
          OR: [
            { produto: { is: { nomeComercial: { contains: query } } } },
            { produto: { is: { nomeGenerico: { contains: query } } } },
            { produto: { is: { barcode: { contains: query } } } },
            {
              produto: {
                is: {
                  categoria: {
                    is: {
                      nome: { contains: query },
                      deletedAt: null,
                    },
                  },
                },
              },
            },
            ...( /^\d+$/.test(query)
              ? [{ produto: { is: { id: BigInt(query) } } }]
              : [] ),
          ],
        }
      : {};

    const loteWhere = {
      ...loteWhereBase,
      ...(query ? queryFilters : {}),
    };

    // Estratégia:
    // - Buscar lotes FEFO + produto (sem depender de `lote_stock_balances`).
    // - Calcular quantidadeDisponivel a partir de movimentos quando necessário.
    // - Agrupar por produto e paginar por produto.
    const lotes = await prisma.lote.findMany({
      where: loteWhere,
      orderBy: [
        { produtoId: "asc" },
        { dataValidade: "asc" },
        { createdAt: "asc" },
      ],
      take: 4000,
      select: {
        id: true,
        produtoId: true,
        numeroLote: true,
        dataValidade: true,
        precoVenda: true,
        quantidadeQuarentena: true,
        produto: { select: produtoPosSelect },
      },
    });

    const byProduto = new Map<
      string,
      { produto: any; lotes: any[]; sum: number }
    >();
    for (const lote of lotes) {
      const pid = String(lote.produtoId);
      const disponivel = await getLoteQuantidadeDisponivel(prisma, lote);
      if (disponivel <= 0) continue;
      const current = byProduto.get(pid);
      if (!current) {
        byProduto.set(pid, {
          produto: lote.produto,
          lotes: [
            {
              id: lote.id,
              numeroLote: lote.numeroLote,
              dataValidade: lote.dataValidade,
              precoVenda: lote.precoVenda,
              stockBalance: { quantidadeDisponivel: disponivel },
            },
          ],
          sum: disponivel,
        });
      } else {
        current.lotes.push({
          id: lote.id,
          numeroLote: lote.numeroLote,
          dataValidade: lote.dataValidade,
          precoVenda: lote.precoVenda,
          stockBalance: { quantidadeDisponivel: disponivel },
        });
        current.sum += disponivel;
      }
    }

    const allProdutoIds = Array.from(byProduto.keys()).sort((a, b) =>
      Number(a) - Number(b),
    );
    const totalCount = allProdutoIds.length;
    const start = (page - 1) * pageSize;
    const slice = allProdutoIds.slice(start, start + pageSize);

    const mapped = slice
      .map((id) => {
        const entry = byProduto.get(id);
        if (!entry) return null;
        const row = {
          ...(entry.produto as Record<string, unknown>),
          stockBalance: { quantidadeDisponivel: entry.sum },
          // FEFO: lotes já estão ordenados por validade asc.
          lotes: entry.lotes.slice(0, 3),
        };
        return mapPosProduto(row as Record<string, unknown>);
      })
      .filter(Boolean);

    return {
      items: mapped.slice(0, pageSize),
      page,
      pageSize,
      hasMore: start + pageSize < totalCount,
      totalCount,
    };
  }
}
