import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { runWithCentralTenant } from "../../../../../shared/context/central-tenant-context";

export interface GetTenantSubscriptionDTO {
  tenantId: string;
}

export class GetTenantSubscriptionUseCase {
  async execute(data: GetTenantSubscriptionDTO) {
    return runWithCentralTenant(data.tenantId, async () => {
      const prisma = prismaCentralUnscoped as any;
      const subscription = await prisma.subscription.findFirst({
        where: {
          tenantId: BigInt(data.tenantId),
          deletedAt: null,
        },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              slug: true,
              monthlyPrice: true,
              includedBranches: true,
              extraBranchPrice: true,
              isEnterprise: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!subscription) {
        throw new Error("Subscrição não encontrada para este tenant.");
      }

      const activeBranches = await prisma.branch.count({
        where: {
          tenantId: BigInt(data.tenantId),
          active: true,
          deletedAt: null,
        },
      });

      return {
        id: subscription.id.toString(),
        tenantId: subscription.tenantId.toString(),
        status: subscription.status,
        branchesUsed: subscription.branchesUsed,
        activeBranches,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        trialEndsAt: subscription.trialEndsAt,
        lastBillingAt: subscription.lastBillingAt,
        nextBillingAt: subscription.nextBillingAt,
        plan: subscription.plan,
      };
    });
  }
}
