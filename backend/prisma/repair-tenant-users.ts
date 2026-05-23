import { PrismaClient as PrismaTenantClient } from "../src/infrastructure/prisma/tenant/generated/tenant";
import { prismaCentralUnscoped } from "../src/infrastructure/prisma/prisma-central.service";

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
    include: {
      tenant: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!branch) {
    throw new Error(`Branch com dbName='${dbName}' não encontrada na base central.`);
  }

  const tenantId = branch.tenantId;
  const centralUsers = await prismaCentralUnscoped.user.findMany({
    where: {
      OR: [
        { id: branch.tenant.ownerId },
        {
          userTenants: {
            some: { tenantId, active: true, deletedAt: null },
          },
        },
      ],
      active: true,
      deletedAt: null,
    },
    select: { id: true, name: true, email: true },
    distinct: ["id"],
  });

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

    for (const centralUser of centralUsers) {
      const email = centralUser.email.trim().toLowerCase();
      const existing = await prismaTenant.user.findFirst({
        where: {
          OR: [{ email }, { centralUserId: centralUser.id }],
          deletedAt: null,
        },
      });

      if (existing) {
        await prismaTenant.user.update({
          where: { id: existing.id },
          data: {
            name: centralUser.name,
            email,
            centralUserId: centralUser.id,
            active: true,
          },
        });
        console.log(`↻ Atualizado tenant user #${existing.id} (${email})`);
        continue;
      }

      const created = await prismaTenant.user.create({
        data: {
          name: centralUser.name,
          email,
          role: "ADMIN",
          centralUserId: centralUser.id,
        },
      });
      console.log(`✚ Criado tenant user #${created.id} (${email})`);
    }

    const total = await prismaTenant.user.count({ where: { deletedAt: null } });
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
