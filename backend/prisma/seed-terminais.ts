import { PrismaClient } from "../src/infrastructure/prisma/tenant/generated/tenant";

const prisma = new PrismaClient();

async function main() {
  console.log(`🚀 Iniciando seed de terminais e caixas...`);

  // 0. Garantir existência do usuário ID 1 para os movimentos
  await prisma.user.upsert({
    where: { id: BigInt(1) },
    update: {},
    create: {
      id: BigInt(1),
      name: "Admin Sistema",
      email: "admin@farmacia.com",
      role: "ADMIN",
      centralUserId: BigInt(1)
    }
  });

  // 1. Criar Terminais
  const terminal1 = await prisma.terminal.upsert({
    where: { id: BigInt(1) },
    update: {},
    create: {
      id: BigInt(1),
      nome: "Terminal 01 - Balcão Principal",
      codigo: "T01",
      ativo: true
    }
  });

  const terminal2 = await prisma.terminal.upsert({
    where: { id: BigInt(2) },
    update: {},
    create: {
      id: BigInt(2),
      nome: "Terminal 02 - Balcão Secundário",
      codigo: "T02",
      ativo: true
    }
  });

  // 2. Criar Caixas vinculados aos Terminais
  await (prisma as any).caixa.upsert({
    where: { terminalId: terminal1.id },
    update: {},
    create: {
      terminalId: terminal1.id,
      saldoAtual: 0
    }
  });

  await (prisma as any).caixa.upsert({
    where: { terminalId: terminal2.id },
    update: {},
    create: {
      terminalId: terminal2.id,
      saldoAtual: 0
    }
  });

  // 3. Obter o primeiro produto para criar o lote de teste
  const firstProduto = await prisma.produto.findFirst();

  if (!firstProduto) {
    console.warn("⚠️ Nenhum produto encontrado. O seed de medicamentos já rodou?");
  } else {
    console.log(`📦 Criando lote para o produto: ${firstProduto.nome} (ID: ${firstProduto.id})`);
    
    await prisma.lote.upsert({
      where: { id: BigInt(1) },
      update: {
        ativo: true
      },
      create: {
        id: BigInt(1),
        produtoId: firstProduto.id,
        numeroLote: "TEST-BATCH-001",
        dataValidade: new Date("2028-12-31"),
        quantidadeInicial: 100,
        precoCompra: 50,
        ativo: true
      }
    });
  }

  console.log("✅ Seed de terminais, caixas e lote de teste concluído!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
