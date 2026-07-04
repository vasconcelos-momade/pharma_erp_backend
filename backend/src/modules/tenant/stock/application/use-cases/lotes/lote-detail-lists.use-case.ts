import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { NotFoundApiError } from "../../../../../../shared/http/api-error";

export class ListLoteMovimentosUseCase {
  async execute(loteId: string, page = 1, pageSize = 20) {
    const prisma = getPrisma() as any;
    const lote = await prisma.lote.findFirst({
      where: { id: BigInt(loteId), deletedAt: null },
      select: { id: true },
    });
    if (!lote) throw new NotFoundApiError(`Lote ${loteId} não encontrado`);

    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const where = { loteId: lote.id, deletedAt: null };

    const [totalCount, rows] = await prisma.$transaction([
      prisma.estoqueMovimento.count({ where }),
      prisma.estoqueMovimento.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
          produto: { select: { id: true, nomeComercial: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (safePage - 1) * safeSize,
        take: safeSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, safeSize).map((m: any) => ({
        id: m.id.toString(),
        tipo: m.tipo,
        quantidade: Number(m.quantidade),
        estoqueAnterior: Number(m.estoqueAnterior),
        estoqueFinal: Number(m.estoqueFinal),
        origem: m.origem ?? null,
        observacoes: m.observacoes ?? null,
        createdAt: m.createdAt.toISOString(),
        user: m.user ? { id: m.user.id.toString(), nome: m.user.name } : null,
      })),
      page: safePage,
      pageSize: safeSize,
      hasMore: rows.length > safeSize,
      totalCount,
    };
  }
}

export class ListLoteReservasUseCase {
  async execute(loteId: string) {
    const prisma = getPrisma() as any;
    const rows = await prisma.estoqueReserva.findMany({
      where: { loteId: BigInt(loteId) },
      include: { fatura: { select: { id: true, numero: true } } },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((r: any) => ({
      id: r.id.toString(),
      quantidade: Number(r.quantidade),
      expiresAt: r.expiresAt.toISOString(),
      fatura: r.fatura
        ? { id: r.fatura.id.toString(), numero: r.fatura.numero }
        : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

export class ListLoteDispensacoesUseCase {
  async execute(loteId: string) {
    const prisma = getPrisma() as any;
    const rows = await prisma.dispensacao.findMany({
      where: { loteId: BigInt(loteId), deletedAt: null },
      include: {
        user: { select: { id: true, name: true } },
        produto: { select: { id: true, nomeComercial: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((d: any) => ({
      id: d.id.toString(),
      quantidade: Number(d.quantidade),
      tipoDispensacao: d.tipoDispensacao,
      createdAt: d.createdAt.toISOString(),
      user: d.user ? { id: d.user.id.toString(), nome: d.user.name } : null,
    }));
  }
}

export class ListLoteIncineracoesUseCase {
  async execute(loteId: string) {
    const prisma = getPrisma() as any;
    const rows = await prisma.incineracaoItem.findMany({
      where: { loteId: BigInt(loteId) },
      include: {
        incineracao: {
          select: {
            id: true,
            numeroAuto: true,
            dataIncineracao: true,
          },
        },
      },
      orderBy: { incineracao: { dataIncineracao: "desc" } },
    });

    return rows.map((item: any) => ({
      id: item.id.toString(),
      quantidade: Number(item.quantidade),
      incineracao: item.incineracao
        ? {
            id: item.incineracao.id.toString(),
            numeroAuto: item.incineracao.numeroAuto,
            dataIncineracao: item.incineracao.dataIncineracao.toISOString(),
          }
        : null,
      createdAt: item.incineracao?.dataIncineracao?.toISOString() ?? null,
    }));
  }
}

export class ListProductPriceHistoryUseCase {
  async execute(produtoId: string, page = 1, pageSize = 20) {
    const prisma = getPrisma() as any;
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const where = { produtoId: BigInt(produtoId) };

    const [totalCount, rows] = await prisma.$transaction([
      prisma.historicoPreco.count({ where }),
      prisma.historicoPreco.findMany({
        where,
        include: { fornecedor: { select: { id: true, nome: true } } },
        orderBy: { data: "desc" },
        skip: (safePage - 1) * safeSize,
        take: safeSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, safeSize).map((h: any) => ({
        id: h.id.toString(),
        precoAnterior: Number(h.precoAnterior),
        precoNovo: Number(h.precoNovo),
        variacao: h.variacao != null ? Number(h.variacao) : null,
        data: h.data.toISOString(),
        fornecedor: h.fornecedor
          ? { id: h.fornecedor.id.toString(), nome: h.fornecedor.nome }
          : null,
      })),
      page: safePage,
      pageSize: safeSize,
      hasMore: rows.length > safeSize,
      totalCount,
    };
  }
}
