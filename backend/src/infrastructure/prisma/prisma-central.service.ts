import { PrismaClient } from './central/generated/central';
import { extendWithTenantScope } from './central-tenant-scope';

const baseClient = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

/** Cliente central com filtro automático por tenantId quando centralTenantContext está ativo. */
export const prismaCentral = extendWithTenantScope(baseClient);

export const prismaCentralUnscoped = baseClient;

export default prismaCentral;
