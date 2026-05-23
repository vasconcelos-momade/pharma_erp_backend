import { prismaCentral } from "./infrastructure/prisma/prisma-central.service";
import { RegisterTenantUseCase } from "./modules/central/tenants/application/use-cases/register-tenant.use-case";
import bcrypt from "bcryptjs";

async function test() {
  console.log("🧪 Iniciando Teste de Registro de Tenant...");

  try {
    // 1. Garantir que temos um usuário dono no Central
    const email = "admin@skalway.com";
    let user = await prismaCentral.user.findUnique({ where: { email } });

    if (!user) {
      console.log("👤 Criando usuário administrador global...");
      const hashedPassword = await bcrypt.hash("admin123", 10);
      user = await prismaCentral.user.create({
        data: {
          name: "Admin Global",
          email: email,
          password: hashedPassword,
          role: "superadmin",
        },
      });
    }

    // 2. Instanciar o Use Case
    const registerTenant = new RegisterTenantUseCase();

    // 3. Tentar registrar um novo tenant
    const result = await registerTenant.execute({
      nomeEmpresa: "Farmácia Central de Maputo",
      nomeTenant: "farmacia_maputo",
      adminName: "Gerente Farmácia",
      adminEmail: "gerente@farmaciamaputo.com",
      adminPassword: "password123",
      userId: user.id.toString(),
    });

    console.log("✅ Resultado do Registro:", result);
    console.log("🚀 Teste finalizado com sucesso!");
  } catch (error) {
    console.error("❌ Falha no teste:", error);
  } finally {
    await prismaCentral.$disconnect();
  }
}

test();
