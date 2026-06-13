import { PrismaClient } from "../src/infrastructure/prisma/tenant/generated/tenant";
import process from "node:process";
import {
  expandRolePermissionMatrix,
  listStandardActions,
  listStandardModules,
} from "../src/modules/tenant/shared/permission.constants";

const prisma = new PrismaClient();

async function main() {
  const modules = listStandardModules();
  const actions = listStandardActions();
  const rows = expandRolePermissionMatrix();

  console.log("🔐 Semeando matriz padrao de role_permissions...");

  await prisma.rolePermission.deleteMany({
    where: {
      module: { in: modules as any[] },
      action: { in: actions as any[] },
    },
  });

  await prisma.rolePermission.createMany({
    data: rows.map((row) => ({
      role: row.role as any,
      module: row.module as any,
      action: row.action as any,
    })),
    skipDuplicates: true,
  });

  console.log(`✅ ${rows.length} permissoes por role aplicadas com sucesso.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
