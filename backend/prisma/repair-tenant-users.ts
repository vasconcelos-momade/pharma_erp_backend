import { PrismaClient as PrismaTenantClient } from "../src/infrastructure/prisma/tenant/generated/tenant";
import { prismaCentralUnscoped } from "../src/infrastructure/prisma/prisma-central.service";
import { syncTenantUsersFromCentral } from "../src/infrastructure/database/sync-tenant-users.service";

const dbName = process.argv[2]?.trim();
const rootPassword = process.env.MYSQL_ROOT_PASSWORD ?? "root_password";
const dbHost = process.env.TENANT_DB_HOST ?? process.env.MYSQL_HOST ?? "mysql_central";
const dbPort = process.env.TENANT_DB_PORT ?? process.env.MYSQL_PORT ?? "3306";

if (!dbName) {
  console.error("Uso: bun prisma/repair-tenant-users.ts <tenant_db_name>");
  console.error("Exemplo: bun prisma/repair-tenant-users.ts tenant_farmacia_1779410837");
  process.exit(1);
}

async function main() {
  const branch = await prismaCentralUnscoped.branch.findFirst({
    where: { dbName },
    select: { tenantId: true },
  });

  if (!branch) {
    throw new Error(`Branch com dbName='${dbName}' não encontrada na base central.`);
  }

  const dbUrl = `mysql://root:${rootPassword}@${dbHost}:${dbPort}/${dbName}`;
  const prismaTenant = new PrismaTenantClient({
    datasources: { db: { url: dbUrl } },
  });

  try {
    const table = await prismaTenant.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
      dbName,
    );
    const hasUsersTable = Number(table[0]?.cnt ?? 0) > 0;
    if (!hasUsersTable) {
      throw new Error(
        `A base '${dbName}' não tem a tabela 'users'. Corra primeiro: DATABASE_URL_TENANT='${dbUrl}' bun run prisma:deploy:tenant`,
      );
    }

    const total = await syncTenantUsersFromCentral({
      tenantId: branch.tenantId,
      prismaTenant,
    });
    console.log(`✅ '${dbName}' tem ${total} utilizador(es) tenant.`);
  } finally {
    await prismaTenant.$disconnect();
    await prismaCentralUnscoped.$disconnect();
  }
}

main().catch((error) => {
  console.error("❌", error instanceof Error ? error.message : error);
  process.exit(1);
});
