import type { PrismaClient as PrismaTenantClient } from "../../../infrastructure/prisma/tenant/generated/tenant";

export class TenantUserNotFoundError extends Error {
  constructor(message = "Utilizador não encontrado nesta farmácia.") {
    super(message);
    this.name = "TenantUserNotFoundError";
  }
}

export type ResolveTenantUserInput = {
  centralUserId: string;
  email?: string | null;
};

type TenantUserDelegate = Pick<PrismaTenantClient, "user">;

/**
 * Mapeia o utilizador autenticado na central (`users.id` do JWT)
 * para o `users.id` da base tenant (`users.centralUserId`).
 */
export async function resolveTenantUserId(
  prisma: TenantUserDelegate,
  input: ResolveTenantUserInput,
): Promise<bigint> {
  const centralId = BigInt(input.centralUserId);

  const byCentralLink = await prisma.user.findFirst({
    where: {
      centralUserId: centralId,
      deletedAt: null,
      active: true,
    },
    select: { id: true },
  });

  if (byCentralLink) {
    return byCentralLink.id;
  }

  const normalizedEmail = input.email?.trim().toLowerCase();
  if (normalizedEmail) {
    const byEmail = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        deletedAt: null,
        active: true,
      },
      select: { id: true },
    });

    if (byEmail) {
      return byEmail.id;
    }
  }

  // Compatibilidade com seeds antigos (id tenant = id central, centralUserId preenchido).
  const byId = await prisma.user.findFirst({
    where: {
      id: centralId,
      deletedAt: null,
      active: true,
    },
    select: { id: true, centralUserId: true },
  });

  if (
    byId &&
    (byId.centralUserId === null || byId.centralUserId === centralId)
  ) {
    return byId.id;
  }

  throw new TenantUserNotFoundError(
    "Utilizador não encontrado nesta farmácia. Verifique o vínculo centralUserId ou faça login novamente.",
  );
}
