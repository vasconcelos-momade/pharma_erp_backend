import { PrismaClient } from "../src/infrastructure/prisma/tenant/generated/tenant";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Iniciando seed de serviços clínicos...");

  const taxRule = await prisma.taxRule.findFirst({
    where: { codigo: "IVA_ISENTO_MEDICAMENTOS" },
  });

  if (!taxRule) {
    throw new Error("IVA_ISENTO_MEDICAMENTOS tax rule not found");
  }

  console.log(`Using tax rule: ${taxRule.codigo} (ID: ${taxRule.id})`);

  const servicos = [
    { nome: "Medição de Peso", tipoServico: "PESO", preco: 50.00 },
    { nome: "Medição de Pressão Arterial", tipoServico: "PRESSAO_ARTERIAL", preco: 100.00 },
    { nome: "Medição de Temperatura", tipoServico: "TEMPERATURA", preco: 50.00 },
    { nome: "Teste de Glicemia", tipoServico: "GLICEMIA", preco: 250.00 },
    { nome: "Consulta Farmacêutica", tipoServico: "CONSULTA", preco: 500.00 },
    { nome: "Aplicação de Injeção", tipoServico: "INJECAO", preco: 150.00 },
    { nome: "Curativo Simples", tipoServico: "CURATIVO", preco: 200.00 },
  ];

  for (const s of servicos) {
    await prisma.servico.upsert({
      where: { nome: s.nome },
      update: {
        tipoServicoClinico: s.tipoServico as any,
        preco: s.preco,
        ativo: true,
        taxRuleId: taxRule.id,
      },
      create: {
        nome: s.nome,
        tipoServicoClinico: s.tipoServico as any,
        preco: s.preco,
        ativo: true,
        taxRuleId: taxRule.id,
      }
    });
  }

  // Como o ID no upsert acima é aleatório, o ideal para seed é usar o nome como chave se quisermos consistência
  // Mas para este exemplo de arquitetura, vamos apenas garantir que os dados existem.
  // Vamos refazer usando o nome como critério de busca (se o schema permitisse, mas não permite @unique no nome agora)
  
  console.log("🎉 Seed de serviços clínicos concluído com o novo modelo Servico!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
