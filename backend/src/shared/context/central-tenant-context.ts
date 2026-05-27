import { AsyncLocalStorage } from "async_hooks";

export interface CentralTenantContextStore {
  tenantId: string;
  /** Superadmin / jobs internos podem desativar o scope */
  bypassTenantScope?: boolean;
}

export const centralTenantContext = new AsyncLocalStorage<CentralTenantContextStore>();

export function getCentralTenantId(): string | undefined {
  return centralTenantContext.getStore()?.tenantId;
}

export function isTenantScopeBypassed(): boolean {
  return Boolean(centralTenantContext.getStore()?.bypassTenantScope);
}

export function runWithCentralTenant<T>(
  tenantId: string,
  fn: () => T | Promise<T>,
  options?: { bypassTenantScope?: boolean },
): T | Promise<T> {
  return centralTenantContext.run(
    { tenantId, bypassTenantScope: options?.bypassTenantScope },
    fn,
  );
}
