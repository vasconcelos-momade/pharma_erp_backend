import { PrismaClient } from "../src/infrastructure/prisma/tenant/generated/tenant";
import { FNM_CATEGORIAS } from "../src/modules/tenant/products/domain/fnm-categorias";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed categorias FNM...");

  await prisma.categoria.createMany({
    data: FNM_CATEGORIAS.map((item) => ({
      nome: item.nome,
      codigoFNM: item.codigoFNM,
      descricao: "Categoria terapêutica FNM (Nível 1)",
      ativo: true,
    })),
    skipDuplicates: true,
  });

  const total = await prisma.categoria.count({
    where: { codigoFNM: { not: null }, deletedAt: null },
  });

  console.log(`✅ Categorias FNM activas: ${total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
