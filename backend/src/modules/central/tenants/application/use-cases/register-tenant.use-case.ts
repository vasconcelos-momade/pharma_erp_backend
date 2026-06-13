import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { MySqlManagementService } from "../../../../../infrastructure/database/mysql-management.service";
import { TenantPrismaFactory } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { branchContext } from "../../../../../shared/context/branch-context";
import { encryptTenantDbPassword } from "../../../../../infrastructure/security/tenant-db-credentials";
import { EmailService } from "../../../../../infrastructure/notifications/email.service";

export interface RegisterTenantDTO {
  nomeEmpresa: string;
  nomeTenant: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  userId: string; // The owner user ID in Central
}

const runtimeGlobals = globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
  console?: {
    log: (...args: unknown[]) => void;
  };
};

export class RegisterTenantUseCase {
  async execute(data: RegisterTenantDTO) {
    const prisma = prismaCentralUnscoped as any;
    const dbName = `tenant_${data.nomeTenant.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    const adminEmail = data.adminEmail.trim().toLowerCase();
    const dbPasswordPlain = runtimeGlobals.process?.env?.MYSQL_ROOT_PASSWORD;
    if (!dbPasswordPlain) {
      throw new Error("MYSQL_ROOT_PASSWORD não definido.");
    }
    const { cipherText, iv, tag } = encryptTenantDbPassword(dbPasswordPlain);
    const dbHost = runtimeGlobals.process?.env?.MYSQL_HOST || "mysql_central";
    const dbPort = Number(runtimeGlobals.process?.env?.MYSQL_PORT || 3306);

    runtimeGlobals.console?.log(`🚀 Iniciando registro do tenant: ${data.nomeTenant}`);

    // 1. Create record in Central Database
    const tenant = await prisma.tenant.create({
      data: {
        companyName: data.nomeEmpresa,
        name: data.nomeTenant,
        ownerId: BigInt(data.userId),
        status: "trial",
      }
    });

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        country: "MZ",
        createdBy: BigInt(data.userId),
        updatedBy: BigInt(data.userId),
      },
    });

    await prisma.tenantSetting.createMany({
      data: [{ tenantId: tenant.id, key: "language", value: "pt" }],
    });

    // 1.2 Grant all central permissions to the owner for this tenant
    const allPermissions = await prisma.permission.findMany();
    if (allPermissions.length > 0) {
      await prisma.userPermission.createMany({
        data: allPermissions.map((p: any) => ({
          userId: BigInt(data.userId),
          permissionId: p.id,
          tenantId: tenant.id,
          allowed: true,
        }))
      });
    }

    // 2. Link user to tenant in Central
    await prisma.userTenant.create({
      data: {
        userId: BigInt(data.userId),
        tenantId: tenant.id,
        role: "ADMIN",
        active: true,
      }
    });

    // 2.1 Create default Subscription (Base)
    const defaultPlan =
      await prisma.plan.findUnique({ where: { slug: "base" } }) ??
      await prisma.plan.findUnique({ where: { slug: "starter" } });

    if (!defaultPlan) {
      throw new Error("Nenhum plano padrao foi encontrado. Rode o seed de planos antes de criar tenants.");
    }

    const startDate = new Date();
    const trialEndsAt = new Date(startDate);
    trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + 7);

    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: defaultPlan.id,
        branchesUsed: 1,
        status: "trial",
        startDate,
        trialEndsAt,
        nextBillingAt: trialEndsAt,
        createdBy: BigInt(data.userId),
        updatedBy: BigInt(data.userId),
      }
    });

    const branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        code: "HQ",
        name: `${data.nomeEmpresa} - Matriz`,
        isHeadOffice: true,
        active: true,
        dbHost,
        dbPort,
        dbName,
        dbUsername: "root",
        dbPasswordCipherText: cipherText,
        dbPasswordIv: iv,
        dbPasswordTag: tag,
        createdBy: BigInt(data.userId),
        updatedBy: BigInt(data.userId),
      },
    });

    // 3. Create the physical MySQL Database
    await MySqlManagementService.createDatabase(dbName);

    // 4. Run Prisma migrations on the new Database
    MySqlManagementService.runMigrations(dbName);
    MySqlManagementService.runRolePermissionsSeed(dbName);

    // 5. Create initial users inside the Tenant Database
    // Auth/password vive na base central; aqui guardamos só o vínculo (centralUserId) quando existir.
    const centralForAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true, name: true, email: true },
    });
    const ownerCentral = await prisma.user.findUnique({
      where: { id: BigInt(data.userId) },
      select: { id: true, name: true, email: true },
    });

    await branchContext.run({
      tenantId: tenant.id.toString(),
      branchId: branch.id.toString(),
      dbName,
      dbHost,
      dbPort,
      dbUsername: "root",
      dbPasswordCipherText: cipherText,
      dbPasswordIv: iv,
      dbPasswordTag: tag,
    }, async () => {
      const prismaTenant = TenantPrismaFactory.getClient();

      await prismaTenant.user.create({
        data: {
          name: data.adminName,
          email: adminEmail,
          role: "ADMIN",
          centralUserId: centralForAdmin?.id ?? null,
        },
      });

      const shouldCreateOwnerUser =
        ownerCentral &&
        ownerCentral.email.toLowerCase() !== adminEmail &&
        (!centralForAdmin || centralForAdmin.id !== ownerCentral.id);

      if (shouldCreateOwnerUser) {
        await prismaTenant.user.create({
          data: {
            name: ownerCentral.name,
            email: ownerCentral.email,
            role: "ADMIN",
            centralUserId: ownerCentral.id,
          },
        });
      }
    });

    const notificationEmail = ownerCentral?.email ?? adminEmail;
    const notificationName = ownerCentral?.name ?? data.adminName;

    await EmailService.send({
      to: notificationEmail,
      subject: `Trial iniciado para ${data.nomeEmpresa}`,
      text: [
        `O tenant ${data.nomeEmpresa} foi criado com sucesso.`,
        `Plano: ${defaultPlan.name}.`,
        `Trial valido ate ${trialEndsAt.toISOString().slice(0, 10)}.`,
        `Branch inicial: ${branch.name} (${branch.code}).`,
        "Ao terminar o trial sera emitida uma factura com 3 dias de prazo para pagamento.",
        `Responsavel registado: ${notificationName}.`,
      ].join("\n"),
    });

    runtimeGlobals.console?.log(`🎉 Tenant ${data.nomeTenant} criado e configurado com sucesso!`);

    return {
      id: tenant.id.toString(),
      companyName: tenant.companyName,
      name: tenant.name,
      branch: {
        id: branch.id.toString(),
        code: branch.code,
        name: branch.name,
      },
    };
  }
}
