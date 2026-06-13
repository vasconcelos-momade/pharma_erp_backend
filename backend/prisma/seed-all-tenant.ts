import { PrismaClient as PrismaTenantClient } from "../src/infrastructure/prisma/tenant/generated/tenant";
import { spawn } from "child_process";
import path from "path";

const TENANT_DB_HOST = process.env.TENANT_DB_HOST || "mysql_central";
const TENANT_DB_PORT = process.env.TENANT_DB_PORT || "3306";
const TENANT_DB_USERNAME = process.env.TENANT_DB_USERNAME || "root";
const TENANT_DB_PASSWORD = process.env.TENANT_DB_PASSWORD || "root_password";

function buildTenantDbUrl(dbName: string): string {
  return `mysql://${TENANT_DB_USERNAME}:${TENANT_DB_PASSWORD}@${TENANT_DB_HOST}:${TENANT_DB_PORT}/${dbName}`;
}

async function runScript(scriptPath: string, dbUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("bun", [scriptPath], {
      env: {
        ...process.env,
        DATABASE_URL_TENANT: dbUrl,
      },
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script ${scriptPath} exited with code ${code}`));
      }
    });

    child.on("error", reject);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dbName = args[0];

  if (!dbName) {
    console.error("❌ Por favor, forneça o nome do banco de dados do tenant.");
    console.error("Uso: bun prisma/seed-all-tenant.ts <nome-do-banco>");
    console.error("Exemplo: bun prisma/seed-all-tenant.ts tenant_farmacia_1779294744");
    process.exit(1);
  }

  const dbUrl = buildTenantDbUrl(dbName);
  console.log(`🚀 Iniciando seed completo para o tenant: ${dbName}`);
  console.log(`📊 URL do banco: ${dbUrl.replace(/:[^:]*@/, ":***@")}\n`);

  try {
    console.log("1️⃣  Executando seed de permissoes por role...");
    await runScript("prisma/seed-role-permissions.ts", dbUrl);
    console.log("✅ Seed de permissoes por role concluido!\n");

    console.log("2️⃣  Executando seed de regras fiscais...");
    const prisma = new PrismaTenantClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    });

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
      console.log(`   ✅ Tax rule ${rule.codigo} upserted`);
    }
    await prisma.$disconnect();
    console.log("✅ Seed de regras fiscais concluido!\n");

    console.log("3️⃣  Executando seed de medicamentos...");
    await runScript("prisma/seed-medicamentos.ts", dbUrl);
    console.log("✅ Seed de medicamentos concluido!\n");

    console.log("4️⃣  Executando seed de servicos...");
    await runScript("prisma/seed-servicos.ts", dbUrl);
    console.log("✅ Seed de servicos concluido!\n");

    console.log("5️⃣  Executando seed de terminais...");
    await runScript("prisma/seed-terminais.ts", dbUrl);
    console.log("✅ Seed de terminais concluido!\n");

    console.log("6️⃣  Executando seed de estoque...");
    await runScript("prisma/seed-estoque.ts", dbUrl);
    console.log("✅ Seed de estoque concluido!\n");

    console.log("🎉 Seed completo para o tenant", dbName, "concluído com sucesso!");
  } catch (error) {
    console.error("\n❌ Erro durante o seed:", error);
    process.exit(1);
  }
}

main();
