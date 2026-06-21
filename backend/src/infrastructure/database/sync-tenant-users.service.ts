import { prismaCentralUnscoped } from "../prisma/prisma-central.service";
import type { PrismaClient as PrismaTenantClient } from "../prisma/tenant/generated/tenant";

export interface TenantUserSeedInput {
  name: string;
  email: string;
  centralUserId?: bigint | null;
}

async function upsertTenantUser(
  prismaTenant: PrismaTenantClient,
  user: TenantUserSeedInput,
) {
  const email = user.email.trim().toLowerCase();
  const existing = await prismaTenant.user.findFirst({
    where: {
      OR: [
        { email },
        ...(user.centralUserId != null ? [{ centralUserId: user.centralUserId }] : []),
      ],
      deletedAt: null,
    },
  });

  if (existing) {
    await prismaTenant.user.update({
      where: { id: existing.id },
      data: {
        name: user.name,
        email,
        centralUserId: user.centralUserId ?? existing.centralUserId,
        active: true,
      },
    });
    return existing.id;
  }

  const created = await prismaTenant.user.create({
    data: {
      name: user.name,
      email,
      role: "ADMIN",
      centralUserId: user.centralUserId ?? null,
    },
  });
  return created.id;
}

/**
 * Sincroniza utilizadores da central para a base tenant (idempotente).
 * Usado no registo de tenant e no script de reparação.
 */
export async function syncTenantUsersFromCentral(params: {
  tenantId: bigint;
  prismaTenant: PrismaTenantClient;
  extraUsers?: TenantUserSeedInput[];
}): Promise<number> {
  const centralUsers = await prismaCentralUnscoped.user.findMany({
    where: {
      OR: [
        {
          tenantsOwned: {
            some: { id: params.tenantId },
          },
        },
        {
          userTenants: {
            some: { tenantId: params.tenantId, active: true, deletedAt: null },
          },
        },
      ],
      active: true,
      deletedAt: null,
    },
    select: { id: true, name: true, email: true },
    distinct: ["id"],
  });

  const usersByEmail = new Map<string, TenantUserSeedInput>();

  for (const centralUser of centralUsers) {
    usersByEmail.set(centralUser.email.trim().toLowerCase(), {
      name: centralUser.name,
      email: centralUser.email,
      centralUserId: centralUser.id,
    });
  }

  for (const extra of params.extraUsers ?? []) {
    const email = extra.email.trim().toLowerCase();
    if (!usersByEmail.has(email)) {
      usersByEmail.set(email, extra);
    }
  }

  for (const user of usersByEmail.values()) {
    await upsertTenantUser(params.prismaTenant, user);
  }

  return params.prismaTenant.user.count({ where: { deletedAt: null } });
}
