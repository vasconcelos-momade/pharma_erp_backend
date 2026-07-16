import { PrismaClient } from "../src/infrastructure/prisma/tenant/generated/tenant";
import { DEFAULT_CLIENTE_NOME, DEFAULT_CLIENTE_NAMES } from "../src/modules/tenant/clients/domain/default-cliente";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.cliente.findFirst({
    where: {
      deletedAt: null,
      OR: DEFAULT_CLIENTE_NAMES.map((nome) => ({ nome })),
    },
    orderBy: { id: "asc" },
  });

  if (existing) {
    if (existing.nome !== DEFAULT_CLIENTE_NOME) {
      await prisma.cliente.update({
        where: { id: existing.id },
        data: { nome: DEFAULT_CLIENTE_NOME },
      });
      console.log(`✅ Cliente padrão renomeado para "${DEFAULT_CLIENTE_NOME}" (id=${existing.id})`);
    } else {
      console.log(`✅ Cliente padrão "${DEFAULT_CLIENTE_NOME}" já existe (id=${existing.id})`);
    }
    return;
  }

  const created = await prisma.cliente.create({
    data: {
      nome: DEFAULT_CLIENTE_NOME,
      tipo: "PACIENTE",
      temPrescricao: false,
    },
  });
  console.log(`✅ Cliente padrão "${DEFAULT_CLIENTE_NOME}" criado (id=${created.id})`);
}

main()
  .catch((error) => {
    console.error("❌ Erro ao seedar Consumidor Final:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
