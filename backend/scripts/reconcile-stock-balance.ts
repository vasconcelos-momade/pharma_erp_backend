/**
 * Reconcilia StockBalance e cache do produto com a soma dos lotes activos.
 * Uso:
 *   bun scripts/reconcile-stock-balance.ts                    # todos os tenants (central)
 *   bun scripts/reconcile-stock-balance.ts tenant_farmacia_X  # um tenant
 */
import { PrismaClient as PrismaCentralClient } from "../src/infrastructure/prisma/central/generated/central";
import { PrismaClient as PrismaTenantClient } from "../src/infrastructure/prisma/tenant/generated/tenant";
import { syncProductStockFromLotes } from "../src/modules/tenant/stock/domain/produto-stock.service";

const TENANT_DB_HOST = process.env.TENANT_DB_HOST || "mysql_central";
const TENANT_DB_PORT = process.env.TENANT_DB_PORT || "3306";
const TENANT_DB_USERNAME = process.env.TENANT_DB_USERNAME || "root";
const TENANT_DB_PASSWORD = process.env.TENANT_DB_PASSWORD || "root_password";

function buildTenantDbUrl(dbName: string): string {
  return `mysql://${TENANT_DB_USERNAME}:${TENANT_DB_PASSWORD}@${TENANT_DB_HOST}:${TENANT_DB_PORT}/${dbName}`;
}

async function listTenantDbNames(explicitDbName?: string): Promise<string[]> {
  if (explicitDbName) {
    return [explicitDbName];
  }

  const central = new PrismaCentralClient();
  try {
    const branches = await central.branch.findMany({
      where: { deletedAt: null, active: true },
      select: { dbName: true },
      distinct: ["dbName"],
    });
    return branches.map((branch) => branch.dbName);
  } finally {
    await central.$disconnect();
  }
}

async function reconcileTenant(dbName: string): Promise<{ corrected: number; checked: number }> {
  const prisma = new PrismaTenantClient({
    datasources: { db: { url: buildTenantDbUrl(dbName) } },
  });

  try {
    const produtoIds = await prisma.lote.findMany({
      where: { deletedAt: null, ativo: true },
      select: { produtoId: true },
      distinct: ["produtoId"],
    });

    let corrected = 0;

    for (const { produtoId } of produtoIds) {
      await prisma.$transaction(async (tx) => {
        const balanceBefore = await tx.stockBalance.findUnique({
          where: { produtoId },
          select: { quantidadeTotal: true },
        });
        const totalBefore = balanceBefore ? Number(balanceBefore.quantidadeTotal) : null;

        const totalAfter = await syncProductStockFromLotes(tx, produtoId);

        if (totalBefore === null || totalBefore !== totalAfter) {
          corrected += 1;
        }
      });
    }

    return { corrected, checked: produtoIds.length };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const explicitDbName = process.argv[2];
  const dbNames = await listTenantDbNames(explicitDbName);

  if (dbNames.length === 0) {
    console.error("Nenhum tenant encontrado para reconciliar.");
    process.exit(1);
  }

  console.log(`Reconciliando stock em ${dbNames.length} tenant(s)...\n`);

  let totalCorrected = 0;
  let totalChecked = 0;

  for (const dbName of dbNames) {
    try {
      const result = await reconcileTenant(dbName);
      totalCorrected += result.corrected;
      totalChecked += result.checked;
      console.log(
        `✓ ${dbName}: ${result.corrected}/${result.checked} produto(s) corrigido(s)`,
      );
    } catch (error) {
      console.error(`✗ ${dbName}:`, error);
      process.exitCode = 1;
    }
  }

  console.log(
    `\nConcluído: ${totalCorrected} correção(ões) em ${totalChecked} produto(s) verificados.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
