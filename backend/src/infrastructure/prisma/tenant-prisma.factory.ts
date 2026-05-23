import { PrismaClient } from './tenant/generated/tenant';
import { getBranchStore } from '../../shared/context/branch-context';
import { decryptTenantDbPassword } from '../security/tenant-db-credentials';

export class TenantPrismaFactory {
  private static clients: Map<string, PrismaClient> = new Map();

  static getClient(): PrismaClient {
    const store = getBranchStore();

    const { dbName, dbHost, dbPort, dbUsername, dbPasswordCipherText, dbPasswordIv, dbPasswordTag } = store;
    const host = dbHost || 'mysql_central';
    const port = dbPort || 3306;
    const username = dbUsername || 'root';
    const password = dbPasswordCipherText && dbPasswordIv
      ? decryptTenantDbPassword(dbPasswordCipherText, dbPasswordIv, dbPasswordTag)
      : process.env.MYSQL_ROOT_PASSWORD || '';

    const dbUrl = `mysql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${dbName}`;

    if (this.clients.has(dbUrl)) {
      return this.clients.get(dbUrl)!;
    }

    const client = new PrismaClient({
      datasourceUrl: dbUrl,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    this.clients.set(dbUrl, client);
    return client;
  }
}

/**
 * Global helper to get the current tenant's Prisma instance
 */
export function getPrisma() {
  return TenantPrismaFactory.getClient();
}
