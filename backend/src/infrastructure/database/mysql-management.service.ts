import { execSync } from "child_process";
import path from "path";
import { prismaCentral } from "../prisma/prisma-central.service";

export class MySqlManagementService {
  /**
   * Creates a new MySQL database for a tenant
   */
  static async createDatabase(dbName: string) {
    console.log(`🛠 [MySQL] Criando banco de dados: ${dbName}`);
    const appUser = (process.env.MYSQL_USER || "admin").replace(/'/g, "''");
    const appHost = (process.env.MYSQL_APP_HOST || "%").replace(/'/g, "''");

    try {
      await prismaCentral.$executeRawUnsafe(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
      await prismaCentral.$executeRawUnsafe(
        `GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${appUser}'@'${appHost}';`
      );
      await prismaCentral.$executeRawUnsafe(`FLUSH PRIVILEGES;`);
      console.log(`✅ [MySQL] Banco ${dbName} criado com sucesso.`);
      console.log(`🔐 [MySQL] Permissoes concedidas para ${appUser}@${appHost} em ${dbName}.`);
    } catch (error) {
      console.error(`❌ [MySQL] Erro ao criar banco ${dbName}:`, error);
      throw new Error(`Falha ao criar banco de dados do tenant.`);
    }
  }

  /**
   * Applies tenant Prisma schema for a specific database
   */
  static runMigrations(dbName: string) {
    console.log(`⚙️ [Prisma] Aplicando migrations no banco: ${dbName}`);
    
    const rootPassword = process.env.MYSQL_ROOT_PASSWORD;
    const dbUrl = `mysql://root:${rootPassword}@mysql_central:3306/${dbName}`;
    const schemaPath = path.resolve("src/infrastructure/prisma/tenant/schema.prisma");

    try {
      execSync(
        `DATABASE_URL_TENANT="${dbUrl}" bun run prisma:deploy:tenant`,
        { stdio: "inherit", env: { ...process.env, DATABASE_URL_TENANT: dbUrl } }
      );
      
      console.log(`✅ [Prisma] Schema sincronizado com sucesso em ${dbName}.`);
    } catch (error) {
      console.error(`❌ [Prisma] Erro ao rodar migrations em ${dbName}:`, error);
      throw new Error(`Falha ao aplicar migrations no banco do tenant.`);
    }
  }
}
