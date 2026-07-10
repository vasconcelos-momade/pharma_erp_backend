import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import type { z } from "zod";
import type {
  createSupplierSchema,
  updateSupplierSchema,
} from "../../dto/suppliers.dto";

type CreateSupplierDTO = z.infer<typeof createSupplierSchema>;
type UpdateSupplierDTO = z.infer<typeof updateSupplierSchema>;

function mapSupplier(row: Record<string, unknown>) {
  return {
    id: (row.id as bigint).toString(),
    nome: row.nome as string,
    tipo: (row.tipo as string | null) ?? null,
    nuit: (row.nuit as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    telefone: (row.telefone as string | null) ?? null,
    telefoneAlt: (row.telefoneAlt as string | null) ?? null,
    endereco: (row.endereco as string | null) ?? null,
    cidade: (row.cidade as string | null) ?? null,
    provincia: (row.provincia as string | null) ?? null,
    pais: (row.pais as string | null) ?? null,
    contatoNome: (row.contatoNome as string | null) ?? null,
    observacoes: (row.observacoes as string | null) ?? null,
    ativo: Boolean(row.ativo),
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

export class SupplierService {
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
              { nome: { contains: search } },
              { nuit: { contains: search } },
              { email: { contains: search } },
              { telefone: { contains: search } },
              { cidade: { contains: search } },
            ],
          }
        : {}),
    };

    const [totalCount, rows] = await prisma.$transaction([
      prisma.fornecedor.count({ where }),
      prisma.fornecedor.findMany({
        where,
        orderBy: { nome: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => mapSupplier(row as Record<string, unknown>)),
      page,
      pageSize,
      totalCount,
      hasMore: page * pageSize < totalCount,
    };
  }

  async get(id: string) {
    const prisma = getPrisma();
    const row = await prisma.fornecedor.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!row) {
      throw new Error("Fornecedor não encontrado.");
    }
    return mapSupplier(row as Record<string, unknown>);
  }

  async create(data: CreateSupplierDTO) {
    const prisma = getPrisma();
    const row = await prisma.fornecedor.create({
      data: {
        nome: data.nome.trim(),
        tipo: data.tipo?.trim() || null,
        nuit: data.nuit?.trim() || null,
        email: data.email?.trim() || null,
        telefone: data.telefone?.trim() || null,
        telefoneAlt: data.telefoneAlt?.trim() || null,
        endereco: data.endereco?.trim() || null,
        cidade: data.cidade?.trim() || null,
        provincia: data.provincia?.trim() || null,
        pais: data.pais?.trim() || "Mocambique",
        contatoNome: data.contatoNome?.trim() || null,
        observacoes: data.observacoes?.trim() || null,
      },
    });
    return mapSupplier(row as Record<string, unknown>);
  }

  async update(id: string, data: UpdateSupplierDTO) {
    const prisma = getPrisma();
    const existing = await prisma.fornecedor.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!existing) {
      throw new Error("Fornecedor não encontrado.");
    }

    const row = await prisma.fornecedor.update({
      where: { id: BigInt(id) },
      data: {
        ...(data.nome !== undefined ? { nome: data.nome.trim() } : {}),
        ...(data.tipo !== undefined ? { tipo: data.tipo?.trim() || null } : {}),
        ...(data.nuit !== undefined ? { nuit: data.nuit?.trim() || null } : {}),
        ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
        ...(data.telefone !== undefined
          ? { telefone: data.telefone?.trim() || null }
          : {}),
        ...(data.telefoneAlt !== undefined
          ? { telefoneAlt: data.telefoneAlt?.trim() || null }
          : {}),
        ...(data.endereco !== undefined
          ? { endereco: data.endereco?.trim() || null }
          : {}),
        ...(data.cidade !== undefined ? { cidade: data.cidade?.trim() || null } : {}),
        ...(data.provincia !== undefined
          ? { provincia: data.provincia?.trim() || null }
          : {}),
        ...(data.pais !== undefined ? { pais: data.pais?.trim() || null } : {}),
        ...(data.contatoNome !== undefined
          ? { contatoNome: data.contatoNome?.trim() || null }
          : {}),
        ...(data.observacoes !== undefined
          ? { observacoes: data.observacoes?.trim() || null }
          : {}),
        ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
      },
    });
    return mapSupplier(row as Record<string, unknown>);
  }

  async delete(id: string) {
    const prisma = getPrisma();
    const existing = await prisma.fornecedor.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!existing) {
      throw new Error("Fornecedor não encontrado.");
    }

    await prisma.fornecedor.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date(), ativo: false },
    });

    return { id, deleted: true };
  }
}
