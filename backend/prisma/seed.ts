import { PrismaClient } from "../src/infrastructure/prisma/central/generated/central";
import bcrypt from "bcryptjs";
import process from "node:process";

const prisma = new PrismaClient();

async function main() {
  // ----------------------------
  // USUÁRIO ADMIN
  // ----------------------------
  const hashedPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@skalway.com" },
    update: {},
    create: {
      name: "Admin SkalWay",
      email: "admin@skalway.com",
      password: hashedPassword,
      role: "superadmin",
    },
  });

  // ----------------------------
  // PLANOS (Modelo de Franquias - Preços em MZN)
  // ----------------------------
  await prisma.plan.upsert({
    where: { slug: "base" },
    update: {
      name: "Plano Base",
      monthlyPrice: 5000,
      includedBranches: 1,
      extraBranchPrice: 2000,
      isEnterprise: false,
      active: true,
    },
    create: {
      name: "Plano Base",
      slug: "base",
      monthlyPrice: 5000,
      includedBranches: 1,
      extraBranchPrice: 2000,
      isEnterprise: false,
      active: true,
    },
  });

  // Alias para compatibilidade ou slug antigo
  await prisma.plan.upsert({
    where: { slug: "starter" },
    update: {
      name: "Plano Base (Starter)",
      monthlyPrice: 5000,
      includedBranches: 1,
      extraBranchPrice: 2000,
      isEnterprise: false,
      active: true,
    },
    create: {
      name: "Plano Base (Starter)",
      slug: "starter",
      monthlyPrice: 5000,
      includedBranches: 1,
      extraBranchPrice: 2000,
      isEnterprise: false,
      active: true,
    },
  });

  await prisma.plan.upsert({
    where: { slug: "enterprise" },
    update: {
      name: "Enterprise",
      monthlyPrice: 0,
      includedBranches: 1,
      extraBranchPrice: 0,
      isEnterprise: true,
      active: true,
    },
    create: {
      name: "Enterprise",
      slug: "enterprise",
      monthlyPrice: 0,
      includedBranches: 1,
      extraBranchPrice: 0,
      isEnterprise: true,
      active: true,
    },
  });

  // ----------------------------
  // PERMISSÕES BASE DO SISTEMA
  // ----------------------------
  const basePermissions = [
    { code: "TENANT_VIEW", name: "Ver dados da empresa" },
    { code: "TENANT_EDIT", name: "Editar dados da empresa" },
    { code: "BRANCH_VIEW", name: "Ver filiais" },
    { code: "BRANCH_CREATE", name: "Criar filiais" },
    { code: "BRANCH_EDIT", name: "Editar filiais" },
    { code: "USER_VIEW", name: "Ver utilizadores" },
    { code: "USER_CREATE", name: "Criar utilizadores" },
    { code: "USER_EDIT", name: "Editar utilizadores" },
    { code: "USER_DELETE", name: "Remover utilizadores" },
    { code: "PRODUCT_VIEW", name: "Ver catálogo de produtos" },
    { code: "PRODUCT_CREATE", name: "Cadastrar produtos" },
    { code: "PRODUCT_EDIT", name: "Editar produtos" },
    { code: "STOCK_VIEW", name: "Ver níveis de stock" },
    { code: "SALE_CREATE", name: "Realizar vendas" },
    { code: "SALE_VIEW", name: "Ver histórico de vendas" },
    { code: "FINANCE_VIEW", name: "Ver relatórios financeiros" },
  ];

  console.log("🔑 Semeando permissões base...");
  for (const p of basePermissions) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name },
      create: p,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
