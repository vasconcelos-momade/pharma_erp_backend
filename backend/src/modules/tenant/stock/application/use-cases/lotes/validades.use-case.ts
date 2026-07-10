import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { mapLoteListItem } from "./lote.mapper";

export class ValidadesDashboardUseCase {
  async execute() {
    const prisma = getPrisma() as any;
    const now = new Date();
    const in30 = new Date(now);
    in30.setDate(in30.getDate() + 30);
    const in60 = new Date(now);
    in60.setDate(in60.getDate() + 60);

    const baseWhere = {
      deletedAt: null,
      ativo: true,
      stockBalance: { quantidadeDisponivel: { gt: 0 } },
    };

    const [expirados, ate30, ate60, valorRows] = await prisma.$transaction([
      prisma.lote.count({
        where: { ...baseWhere, dataValidade: { lt: now } },
      }),
      prisma.lote.count({
        where: {
          ...baseWhere,
          dataValidade: { gte: now, lte: in30 },
        },
      }),
      prisma.lote.count({
        where: {
          ...baseWhere,
          dataValidade: { gt: in30, lte: in60 },
        },
      }),
      prisma.lote.findMany({
        where: {
          ...baseWhere,
          dataValidade: { lte: in60 },
        },
        select: {
          quantidadeQuarentena: true,
          stockBalance: { select: { quantidadeDisponivel: true } },
          precoCompra: true,
        },
      }),
    ]);

    const valorEmRisco = valorRows.reduce((sum: number, row: any) => {
      const qty = Math.max(
        0,
        Number(row.stockBalance?.quantidadeDisponivel ?? row.quantidadeAtual ?? 0),
      );
      return sum + qty * Number(row.precoCompra ?? 0);
    }, 0);

    return {
      lotesExpirados: expirados,
      expiramEm30Dias: ate30,
      expiramEm60Dias: ate60,
      valorFinanceiroEmRisco: Math.round(valorEmRisco * 100) / 100,
    };
  }
}

export class SearchValidadesUseCase {
  async execute(params: {
    q?: string;
    produtoId?: string;
    fornecedorId?: string;
    bucket?: string;
    page?: number;
    pageSize?: number;
  }) {
    const prisma = getPrisma() as any;
    const now = new Date();
    const in30 = new Date(now);
    in30.setDate(in30.getDate() + 30);
    const in60 = new Date(now);
    in60.setDate(in60.getDate() + 60);
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

    const where: Record<string, unknown> = {
      deletedAt: null,
      ativo: true,
      stockBalance: { quantidadeDisponivel: { gt: 0 } },
    };

    if (params.produtoId) where.produtoId = BigInt(params.produtoId);
    if (params.fornecedorId) where.fornecedorId = BigInt(params.fornecedorId);

    switch (params.bucket) {
      case "expirado":
        where.dataValidade = { lt: now };
        break;
      case "30":
        where.dataValidade = { gte: now, lte: in30 };
        break;
      case "60":
        where.dataValidade = { gt: in30, lte: in60 };
        break;
      case "todos":
        break;
      default:
        where.dataValidade = { lte: in60 };
        break;
    }

    const q = params.q?.trim();
    if (q) {
      where.OR = [
        { numeroLote: { contains: q } },
        { produto: { nomeComercial: { contains: q } } },
      ];
    }

    const [totalCount, rows] = await prisma.$transaction([
      prisma.lote.count({ where }),
      prisma.lote.findMany({
        where,
        include: {
          produto: { select: { id: true, nomeComercial: true, barcode: true } },
          fornecedor: { select: { id: true, nome: true } },
        },
        orderBy: [{ dataValidade: "asc" }, { numeroLote: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, pageSize).map((lote: any) => {
        const mapped = mapLoteListItem(lote, now);
        return {
          ...mapped,
          estado:
            mapped.indicadorValidade === "EXPIRADO"
              ? "EXPIRADO"
              : mapped.indicadorValidade === "30_DIAS"
                ? "ATE_30_DIAS"
                : mapped.indicadorValidade === "60_DIAS"
                  ? "ATE_60_DIAS"
                  : "OK",
        };
      }),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }
}
