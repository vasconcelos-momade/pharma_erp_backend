import { MySqlManagementService } from "../../../../../infrastructure/database/mysql-management.service";
import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { TenantPrismaFactory } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { assertTenantBillingActive } from "../../../billing/application/services/tenant-billing-guard.service";
import { branchContext } from "../../../../../shared/context/branch-context";
import { runWithCentralTenant } from "../../../../../shared/context/central-tenant-context";
import { EmailService } from "../../../../../infrastructure/notifications/email.service";

export interface CreateBranchDTO {
  tenantId: string;
  code: string;
  name: string;
}

function normalizeDbIdentifier(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildBranchDbName(tenantId: string, branchCode: string) {
  const normalizedCode = normalizeDbIdentifier(branchCode);
  return `tenant_${tenantId}_branch_${normalizedCode}`.slice(0, 64);
}

async function cloneHqUsersToBranch(params: {
  tenantId: string;
  hqBranchId: string;
  hqDbName: string;
  hqDbHost: string;
  hqDbPort: number;
  hqDbUsername: string;
  hqDbPasswordCipherText: string;
  hqDbPasswordIv: string;
  hqDbPasswordTag?: string | null;
  branchId: string;
  branchDbName: string;
  branchDbHost: string;
  branchDbPort: number;
  branchDbUsername: string;
  branchDbPasswordCipherText: string;
  branchDbPasswordIv: string;
  branchDbPasswordTag?: string | null;
}) {
  const hqUsers = await branchContext.run(
    {
      tenantId: params.tenantId,
      branchId: params.hqBranchId,
      dbName: params.hqDbName,
      dbHost: params.hqDbHost,
      dbPort: params.hqDbPort,
      dbUsername: params.hqDbUsername,
      dbPasswordCipherText: params.hqDbPasswordCipherText,
      dbPasswordIv: params.hqDbPasswordIv,
      dbPasswordTag: params.hqDbPasswordTag,
    },
    async () => {
      const prismaTenant = TenantPrismaFactory.getClient() as any;
      return prismaTenant.user.findMany({
        where: { deletedAt: null },
        select: {
          name: true,
          email: true,
          role: true,
          active: true,
          centralUserId: true,
          userPermissions: {
            select: {
              module: true,
              action: true,
              allowed: true,
            },
          },
        },
      });
    },
  );

  if (hqUsers.length === 0) {
    return 0;
  }

  return branchContext.run(
    {
      tenantId: params.tenantId,
      branchId: params.branchId,
      dbName: params.branchDbName,
      dbHost: params.branchDbHost,
      dbPort: params.branchDbPort,
      dbUsername: params.branchDbUsername,
      dbPasswordCipherText: params.branchDbPasswordCipherText,
      dbPasswordIv: params.branchDbPasswordIv,
      dbPasswordTag: params.branchDbPasswordTag,
    },
    async () => {
      const prismaTenant = TenantPrismaFactory.getClient() as any;

      await prismaTenant.user.createMany({
        data: hqUsers.map((user: any) => ({
          name: user.name,
          email: user.email,
          role: user.role,
          active: user.active,
          centralUserId: user.centralUserId,
        })),
        skipDuplicates: true,
      });

      const branchUsers = await prismaTenant.user.findMany({
        select: {
          id: true,
          email: true,
          centralUserId: true,
        },
      });

      const branchUserByCentralId = new Map<string, any>();
      const branchUserByEmail = new Map<string, any>();

      for (const user of branchUsers) {
        if (user.centralUserId !== null && user.centralUserId !== undefined) {
          branchUserByCentralId.set(String(user.centralUserId), user);
        }
        if (user.email) {
          branchUserByEmail.set(String(user.email).toLowerCase(), user);
        }
      }

      const permissionRows = hqUsers.flatMap((user: any) => {
        const targetUser =
          (user.centralUserId !== null && user.centralUserId !== undefined
            ? branchUserByCentralId.get(String(user.centralUserId))
            : undefined) ??
          (user.email ? branchUserByEmail.get(String(user.email).toLowerCase()) : undefined);

        if (!targetUser || !user.userPermissions?.length) {
          return [];
        }

        return user.userPermissions.map((permission: any) => ({
          userId: targetUser.id,
          module: permission.module,
          action: permission.action,
          allowed: permission.allowed,
        }));
      });

      if (permissionRows.length > 0) {
        await prismaTenant.userPermission.createMany({
          data: permissionRows,
          skipDuplicates: true,
        });
      }

      return prismaTenant.user.count();
    },
  );
}

export class CreateBranchUseCase {
  async execute(data: CreateBranchDTO) {
    await assertTenantBillingActive(data.tenantId);

    return runWithCentralTenant(data.tenantId, async () => {
      const prisma = prismaCentralUnscoped as any;
      const tenantId = BigInt(data.tenantId);
      const dbName = buildBranchDbName(data.tenantId, data.code);

      const setup = await prisma.$transaction(async (tx: any) => {
        const subscription = await tx.subscription.findFirst({
          where: {
            tenantId,
            status: { in: ["trial", "ativo"] },
          },
          include: { plan: true },
          orderBy: { createdAt: "desc" },
        });

        if (!subscription) {
          throw new Error("Tenant não possui assinatura ativa.");
        }

        if (!subscription.plan?.active) {
          throw new Error("O plano atual do tenant está inativo.");
        }

        const hqBranch = await tx.branch.findFirst({
          where: { tenantId, isHeadOffice: true },
        });

        if (!hqBranch) {
          throw new Error("Matriz não encontrada para o tenant.");
        }

        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: {
            companyName: true,
            owner: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        });

        return {
          hqBranchId: hqBranch.id,
          dbHost: hqBranch.dbHost,
          dbPort: hqBranch.dbPort,
          hqDbName: hqBranch.dbName,
          dbUsername: hqBranch.dbUsername,
          dbPasswordCipherText: hqBranch.dbPasswordCipherText,
          dbPasswordIv: hqBranch.dbPasswordIv,
          dbPasswordTag: hqBranch.dbPasswordTag,
          includedBranches: Number(subscription.plan?.includedBranches ?? 1),
          subscriptionId: subscription.id,
          tenant,
        };
      });

      await MySqlManagementService.createDatabase(dbName);
      MySqlManagementService.runMigrations(dbName);
      MySqlManagementService.runRolePermissionsSeed(dbName);

      const result = await prisma.$transaction(async (tx: any) => {
        const createdBranch = await tx.branch.create({
          data: {
            tenantId,
            code: data.code,
            name: data.name,
            isHeadOffice: false,
            active: true,
            dbHost: setup.dbHost,
            dbPort: setup.dbPort,
            dbName,
            dbUsername: setup.dbUsername,
            dbPasswordCipherText: setup.dbPasswordCipherText,
            dbPasswordIv: setup.dbPasswordIv,
            dbPasswordTag: setup.dbPasswordTag,
          },
        });

        const branchesUsed = await tx.branch.count({
          where: { tenantId, active: true, deletedAt: null },
        });

        await tx.subscription.update({
          where: { id: setup.subscriptionId },
          data: {
            branchesUsed: Math.max(branchesUsed, 1),
          },
        });

        return {
          branch: createdBranch,
          branchesUsed,
          includedBranches: setup.includedBranches,
          tenant: setup.tenant,
        };
      });

      const copiedUsers = await cloneHqUsersToBranch({
        tenantId: data.tenantId,
        hqBranchId: String(setup.hqBranchId),
        hqDbName: setup.hqDbName,
        hqDbHost: setup.dbHost,
        hqDbPort: setup.dbPort,
        hqDbUsername: setup.dbUsername,
        hqDbPasswordCipherText: setup.dbPasswordCipherText,
        hqDbPasswordIv: setup.dbPasswordIv,
        hqDbPasswordTag: setup.dbPasswordTag,
        branchId: result.branch.id.toString(),
        branchDbName: dbName,
        branchDbHost: setup.dbHost,
        branchDbPort: setup.dbPort,
        branchDbUsername: setup.dbUsername,
        branchDbPasswordCipherText: setup.dbPasswordCipherText,
        branchDbPasswordIv: setup.dbPasswordIv,
        branchDbPasswordTag: setup.dbPasswordTag,
      });

      const ownerEmail = result.tenant?.owner?.email;
      if (ownerEmail) {
        await EmailService.send({
          to: ownerEmail,
          subject: `Nova branch criada para ${result.tenant.companyName}`,
          text: [
            `A branch ${result.branch.name} (${result.branch.code}) foi criada com sucesso.`,
            `Base de dados dedicada: ${dbName}.`,
            `Utilizadores copiados da matriz: ${copiedUsers}.`,
            `Branches activas actuais: ${result.branchesUsed}.`,
            `Incluidas no plano actual: ${result.includedBranches}.`,
            "Se houver branches extras, elas serao consideradas na proxima factura.",
          ].join("\n"),
        });
      }

      return {
        id: result.branch.id.toString(),
        code: result.branch.code,
        name: result.branch.name,
        dbName,
      };
    });
  }
}
