/**
 * Backfill: copia política das colunas legadas em `produtos` para `produto_regulacao`
 * e cria um evento quando existir classificacaoRule.
 *
 * Uso:
 *   docker exec -e DATABASE_URL_TENANT="mysql://root:root_password@mysql_central:3306/TENANT_DB" \
 *     skalway_pharm_backend bun prisma/backfill-produto-regulacao.ts
 */
import { PrismaClient } from "../src/infrastructure/prisma/tenant/generated/tenant";
import {
  persistProdutoRegulacao,
  policyInputFromProdutoRow,
  toProdutoRegulacaoTx,
} from "../src/modules/tenant/products/domain/produto-regulacao.persistence";
import { resolveProdutoPolicy } from "../src/modules/tenant/products/domain/produto-dispensacao-policy";

const prisma = new PrismaClient();
const BATCH = 200;

async function main() {
  let skip = 0;
  let processed = 0;
  let skipped = 0;

  console.log("🔄 Backfill produto_regulacao a partir de produtos (legado)...");

  for (;;) {
    const produtos = await prisma.produto.findMany({
      take: BATCH,
      skip,
      orderBy: { id: "asc" },
      include: { regulacao: true },
    });

    if (produtos.length === 0) break;
    skip += produtos.length;

    for (const produto of produtos) {

      const existing = await prisma.produtoRegulacao.findUnique({
        where: { produtoId: produto.id },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const policy = resolveProdutoPolicy(
        policyInputFromProdutoRow(produto as Record<string, unknown>),
      );

      await prisma.$transaction(async (tx) => {
        await persistProdutoRegulacao(
          toProdutoRegulacaoTx(tx),
          produto.id,
          policy,
          "backfill:legacy",
        );
      });

      processed++;
      if (processed % 500 === 0) {
        console.log(`   ... ${processed} produtos`);
      }
    }
  }

  console.log(`✅ Backfill concluído: ${processed} criados, ${skipped} já existiam.`);
}

main()
  .catch((err) => {
    console.error("❌ Backfill falhou:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
