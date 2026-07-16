/** Nome canónico do cliente padrão de vendas rápidas. */
export const DEFAULT_CLIENTE_NOME = "Consumidor Final";

/** Nomes legados que devem ser tratados como o mesmo cliente padrão. */
export const DEFAULT_CLIENTE_LEGACY_NAMES = [
  "Cliente Final (Consumidor)",
  "Consumidor final",
] as const;

export const DEFAULT_CLIENTE_NAMES = [
  DEFAULT_CLIENTE_NOME,
  ...DEFAULT_CLIENTE_LEGACY_NAMES,
] as const;

export function isDefaultClienteNome(nome: string | null | undefined): boolean {
  const normalized = (nome ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return DEFAULT_CLIENTE_NAMES.some((n) => n.toLowerCase() === normalized);
}

type PrismaLikeTx = {
  cliente: {
    findFirst: (args: Record<string, unknown>) => Promise<{ id: bigint; nome?: string } | null>;
    create: (args: Record<string, unknown>) => Promise<{ id: bigint }>;
    update: (args: Record<string, unknown>) => Promise<unknown>;
  };
};

/**
 * Garante um cliente "Consumidor Final" e devolve o seu id.
 * Migra nomes legados para o nome canónico quando encontrados.
 */
export async function ensureDefaultCliente(tx: PrismaLikeTx): Promise<bigint> {
  const existing = await tx.cliente.findFirst({
    where: {
      deletedAt: null,
      OR: DEFAULT_CLIENTE_NAMES.map((nome) => ({ nome })),
    },
    select: { id: true, nome: true },
    orderBy: { id: "asc" },
  });

  if (existing) {
    if (existing.nome && existing.nome !== DEFAULT_CLIENTE_NOME) {
      await tx.cliente.update({
        where: { id: existing.id },
        data: { nome: DEFAULT_CLIENTE_NOME },
      });
    }
    return existing.id;
  }

  const created = await tx.cliente.create({
    data: {
      nome: DEFAULT_CLIENTE_NOME,
      tipo: "PACIENTE",
      temPrescricao: false,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Resolve o cliente da venda: usa o informado (se válido) ou o padrão.
 * Nunca devolve null — preserva integridade referencial em Fatura.
 */
export async function resolveVendaClienteId(
  tx: PrismaLikeTx,
  clienteId?: string | null,
): Promise<bigint> {
  const raw = clienteId?.trim();
  if (raw) {
    const found = await tx.cliente.findFirst({
      where: { id: BigInt(raw), deletedAt: null },
      select: { id: true },
    });
    if (!found) {
      throw new Error("Cliente informado para a venda não foi encontrado.");
    }
    return found.id;
  }
  return ensureDefaultCliente(tx);
}
