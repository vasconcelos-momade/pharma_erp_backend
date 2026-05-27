import { PrismaClient } from "../src/infrastructure/prisma/tenant/generated/tenant";

const prisma = new PrismaClient();

async function main() {
  console.log(`🚀 Iniciando seed de estoque de teste...`);

  // 0. Garantir existência do usuário ID 1
  const user = await prisma.user.upsert({
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

  // 1. Obter os primeiros 20 produtos para criar lotes
  const produtos = await prisma.produto.findMany({
    take: 20,
    include: {
      fornecedores: {
        take: 1
      }
    }
  });

  if (produtos.length === 0) {
    console.warn("⚠️ Nenhum produto encontrado. O seed de medicamentos já rodou?");
    return;
  }

  console.log(`📦 Criando lotes e movimentos de estoque para ${produtos.length} produtos...`);

  // 2. Para cada produto, criar um lote e um movimento de entrada
  let count = 0;
  for (const produto of produtos) {
    // Obter fornecedor principal ou criar um padrão
    let fornecedorId = produto.fornecedores[0]?.fornecedorId;
    if (!fornecedorId) {
      const fornecedorPadrao = await prisma.fornecedor.upsert({
        where: { nome: "Fornecedor Geral" },
        update: {},
        create: {
          nome: "Fornecedor Geral",
          ativo: true
        }
      });
      fornecedorId = fornecedorPadrao.id;
    }

    // Criar lote
    const loteNumero = `TEST-${Date.now()}-${count}`;
    const precoCompraLote = Math.round(Number(produto.precoVenda) * 0.65 * 100) / 100;
    const lote = await prisma.lote.create({
      data: {
        produtoId: produto.id,
        fornecedorId,
        numeroLote: loteNumero,
        dataValidade: new Date("2028-12-31"),
        dataFabricacao: new Date(),
        quantidadeInicial: 50,
        quantidadeAtual: 50,
        precoCompra: precoCompraLote,
        precoVenda: produto.precoVenda,
        ativo: true
      }
    });

    // Criar movimento de entrada no estoque
    const estoqueAnterior = Number(produto.estoqueAtual);
    const estoqueFinal = estoqueAnterior + 50;

    await prisma.estoqueMovimento.create({
      data: {
        produtoId: produto.id,
        loteId: lote.id,
        userId: user.id,
        tipo: "ENTRADA",
        quantidade: 50,
        estoqueAnterior,
        estoqueFinal,
        observacoes: "Movimento de entrada de teste"
      }
    });

    // Atualizar estoque atual do produto
    await prisma.produto.update({
      where: { id: produto.id },
      data: {
        estoqueAtual: estoqueFinal
      }
    });

    count++;
    console.log(`✅ Produto ${count}/${produtos.length}: ${produto.nome} (${produto.id}) - Lote: ${loteNumero} - Estoque: ${estoqueFinal}`);
  }

  console.log("✅ Seed de estoque de teste concluído!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
