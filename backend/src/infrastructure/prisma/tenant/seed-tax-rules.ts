import { PrismaClient as PrismaTenantClient } from "./generated/tenant";

const tenantDbUrl = process.env.DATABASE_URL_TENANT?.trim();

const DEFAULT_TAX_RULES = [
  {
    codigo: "IVA_NORMAL_16",
    nome: "IVA Normal - 16%",
    tipo: "IVA_NORMAL" as const,
    taxa: 16,
    descricao: "Taxa normal de IVA aplicada a maioria dos produtos e serviços não essenciais",
    ativo: true,
  },
  {
    codigo: "IVA_ISENTO_MEDICAMENTOS",
    nome: "IVA Isento - Medicamentos Essenciais",
    tipo: "IVA_ISENTO" as const,
    taxa: 0,
    descricao: "Isenção de IVA para medicamentos essenciais conforme regulamentação",
    ativo: true,
  },
  {
    codigo: "NAO_TRIBUTAVEL",
    nome: "Não Tributável",
    tipo: "NAO_TRIBUTAVEL" as const,
    taxa: 0,
    descricao: "Produtos ou serviços não tributáveis por lei",
    ativo: true,
  },
];

async function seedTaxRulesForTenant(dbUrl: string) {
  console.log(`🔄 Seeding tax rules for tenant: ${dbUrl.split("/").pop()}`);
  
  const prisma = new PrismaTenantClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

  try {
    for (const rule of DEFAULT_TAX_RULES) {
      await prisma.taxRule.upsert({
        where: { codigo: rule.codigo },
        update: {
          nome: rule.nome,
          descricao: rule.descricao,
          ativo: rule.ativo,
        },
        create: rule,
      });
      console.log(`  ✅ Tax rule ${rule.codigo} upserted`);
    }
    console.log(`✅ Tax rules seeded successfully for tenant: ${dbUrl.split("/").pop()}`);
  } catch (error) {
    console.error(`❌ Error seeding tax rules for tenant: ${dbUrl.split("/").pop()}`, error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (!tenantDbUrl) {
    throw new Error(
      "Defina DATABASE_URL_TENANT (ex.: mysql://root:root_password@mysql_central:3306/tenant_NOME)",
    );
  }

  console.log("🚀 Starting tax rules seeding...");
  await seedTaxRulesForTenant(tenantDbUrl);
  console.log("🎉 Tax rules seeded successfully!");
}

main().catch((error) => {
  console.error("❌ Error in main seeding process:", error);
  throw error;
});
