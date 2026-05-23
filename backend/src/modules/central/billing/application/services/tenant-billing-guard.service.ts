import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";

/**
 * Tenant ativo ≠ subscription ativa.
 * Bloqueia operações de billing/provisioning quando a subscrição não está válida.
 */
export async function assertTenantBillingActive(tenantId: bigint | string): Promise<void> {
  const prisma = prismaCentralUnscoped as any;
  const id = typeof tenantId === "string" ? BigInt(tenantId) : tenantId;

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { status: true, deletedAt: true },
  });

  if (!tenant || tenant.deletedAt) {
    throw new Error("Tenant não encontrado ou inativo.");
  }

  if (["suspenso", "pendente"].includes(tenant.status)) {
    throw new Error(`Conta tenant em estado '${tenant.status}'. Operação bloqueada.`);
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      tenantId: id,
      deletedAt: null,
      status: { in: ["trial", "ativo"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    throw new Error(
      "Subscrição inexistente ou expirada. Renove o plano para continuar.",
    );
  }

  if (
    subscription.status === "trial" &&
    subscription.trialEndsAt &&
    subscription.trialEndsAt < new Date()
  ) {
    throw new Error("Período de trial expirado. Ative uma subscrição para continuar.");
  }
}
