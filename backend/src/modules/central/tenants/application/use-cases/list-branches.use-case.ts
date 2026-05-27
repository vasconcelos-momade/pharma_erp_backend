import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { runWithCentralTenant } from "../../../../../shared/context/central-tenant-context";

export interface ListBranchesDTO {
  tenantId: string;
  includeInactive?: boolean;
}

export class ListBranchesUseCase {
  async execute(data: ListBranchesDTO) {
    return runWithCentralTenant(data.tenantId, async () => {
      const prisma = prismaCentralUnscoped as any;
      const branches = await prisma.branch.findMany({
        where: {
          tenantId: BigInt(data.tenantId),
          deletedAt: null,
          ...(data.includeInactive ? {} : { active: true }),
        },
        select: {
          id: true,
          code: true,
          name: true,
          isHeadOffice: true,
          active: true,
          connectionStatus: true,
          createdAt: true,
        },
        orderBy: [{ isHeadOffice: "desc" }, { createdAt: "asc" }],
      });

      return branches.map((branch: any) => ({
        id: branch.id.toString(),
        code: branch.code,
        name: branch.name,
        isHeadOffice: branch.isHeadOffice,
        active: branch.active,
        connectionStatus: branch.connectionStatus,
        createdAt: branch.createdAt,
      }));
    });
  }
}
