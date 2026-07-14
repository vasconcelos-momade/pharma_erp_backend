import { getPrisma } from "../../../../infrastructure/prisma/tenant-prisma.factory";
import type { z } from "zod";
import type {
  createTerminalSchema,
  updateTerminalSchema,
} from "../dto/terminal.dto";

type CreateTerminalDTO = z.infer<typeof createTerminalSchema>;
type UpdateTerminalDTO = z.infer<typeof updateTerminalSchema>;

function mapTerminal(row: Record<string, unknown>) {
  const caixa = row.caixa as Record<string, unknown> | null | undefined;
  return {
    id: (row.id as bigint).toString(),
    codigo: row.codigo as string,
    nome: row.nome as string,
    localizacao: (row.localizacao as string | null) ?? null,
    ativo: Boolean(row.ativo),
    caixaId: caixa?.id != null ? (caixa.id as bigint).toString() : null,
    caixa: caixa
      ? {
          id: (caixa.id as bigint).toString(),
          saldoAtual: caixa.saldoAtual?.toString?.() ?? caixa.saldoAtual,
        }
      : null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

export class TerminalService {
  async search(params: {
    query?: string;
    page?: number;
    pageSize?: number;
    includeInactive?: boolean;
  }) {
    const prisma = getPrisma();
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const search = params.query?.trim();

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...(params.includeInactive ? {} : { ativo: true }),
      ...(search
        ? {
            OR: [
              { codigo: { contains: search } },
              { nome: { contains: search } },
              { localizacao: { contains: search } },
            ],
          }
        : {}),
    };

    const [totalCount, rows] = await prisma.$transaction([
      prisma.terminal.count({ where }),
      prisma.terminal.findMany({
        where,
        include: { caixa: true },
        orderBy: { codigo: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => mapTerminal(row as Record<string, unknown>)),
      page,
      pageSize,
      totalCount,
      hasMore: page * pageSize < totalCount,
    };
  }

  async get(id: string) {
    const prisma = getPrisma();
    const row = await prisma.terminal.findFirst({
      where: { id: BigInt(id), deletedAt: null },
      include: { caixa: true },
    });
    if (!row) {
      throw new Error("Terminal não encontrado.");
    }
    return mapTerminal(row as Record<string, unknown>);
  }

  async create(data: CreateTerminalDTO) {
    const prisma = getPrisma();
    const existing = await prisma.terminal.findFirst({
      where: { codigo: data.codigo.trim(), deletedAt: null },
    });
    if (existing) {
      throw new Error("Já existe um terminal com este código.");
    }

    const row = await prisma.$transaction(async (tx) => {
      const terminal = await tx.terminal.create({
        data: {
          codigo: data.codigo.trim(),
          nome: data.nome.trim(),
          localizacao: data.localizacao?.trim() || null,
          ativo: data.ativo ?? true,
        },
      });

      await tx.caixa.create({
        data: {
          terminalId: terminal.id,
          saldoAtual: 0,
        },
      });

      return tx.terminal.findUniqueOrThrow({
        where: { id: terminal.id },
        include: { caixa: true },
      });
    });

    return mapTerminal(row as Record<string, unknown>);
  }

  async update(id: string, data: UpdateTerminalDTO) {
    const prisma = getPrisma();
    const existing = await prisma.terminal.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!existing) {
      throw new Error("Terminal não encontrado.");
    }

    const row = await prisma.terminal.update({
      where: { id: BigInt(id) },
      data: {
        ...(data.nome !== undefined ? { nome: data.nome.trim() } : {}),
        ...(data.localizacao !== undefined
          ? { localizacao: data.localizacao?.trim() || null }
          : {}),
        ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
      },
      include: { caixa: true },
    });
    return mapTerminal(row as Record<string, unknown>);
  }

  async delete(id: string) {
    const prisma = getPrisma();
    const existing = await prisma.terminal.findFirst({
      where: { id: BigInt(id), deletedAt: null },
      include: {
        caixa: {
          include: {
            sessoes: {
              where: { status: "ABERTA", deletedAt: null },
            },
          },
        },
      },
    });
    if (!existing) {
      throw new Error("Terminal não encontrado.");
    }

    const openSessions = existing.caixa?.sessoes?.length ?? 0;
    if (openSessions > 0) {
      throw new Error("Não é possível eliminar um terminal com sessão de caixa aberta.");
    }

    await prisma.terminal.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date(), ativo: false },
    });

    return { id, deleted: true };
  }
}
