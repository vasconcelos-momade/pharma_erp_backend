/**
 * Remove sugestões automáticas de produtos sem histórico de movimentação.
 * Uso: DATABASE_URL_TENANT=... bun scripts/backfill-purchase-suggestions.ts
 */
import { PrismaClient } from "../src/infrastructure/prisma/tenant/generated/tenant";
import { syncStockBalanceCache } from "../src/modules/tenant/stock/domain/produto-stock.service";

const dbUrl =
  process.env.DATABASE_URL_TENANT ??
  "mysql://root:root_password@mysql_central:3306/tenant_farmacia_1783798850";

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

async function main() {
  const removed = await prisma.$executeRaw`
    DELETE ps FROM purchase_suggestions ps
    WHERE ps.origem = 'AUTOMATICA'
      AND NOT EXISTS (
        SELECT 1 FROM estoque_movimentos em
        WHERE em.produtoId = ps.produtoId AND em.deletedAt IS NULL
      )
  `;
  console.log(`Removidas ${removed} sugestão(ões) automáticas sem movimentação.`);

  const produtos = await prisma.produto.findMany({
    where: {
      deletedAt: null,
      ativo: true,
      estoqueMinimo: { gt: 0 },
      movimentos: { some: { deletedAt: null } },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  console.log(`Sincronizando ${produtos.length} produto(s) com movimentação...`);

  for (const produto of produtos) {
    await prisma.$transaction(async (tx) => {
      await syncStockBalanceCache(tx as any, produto.id);
    });
  }

  const suggestions = await prisma.purchaseSuggestion.count();
  console.log(`Concluído. ${suggestions} sugestão(ões) activa(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
