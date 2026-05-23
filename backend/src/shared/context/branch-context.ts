import { AsyncLocalStorage } from "async_hooks";

export interface BranchContextStore {
  tenantId: string;
  branchId: string;
  dbName: string;
  dbHost: string;
  dbPort: number;
  dbUsername: string;
  dbPasswordCipherText: string;
  dbPasswordIv: string;
  dbPasswordTag?: string | null;
}

export const branchContext = new AsyncLocalStorage<BranchContextStore>();
export type BranchStore = BranchContextStore;

export function getBranchStore(): BranchStore {
  const store = branchContext.getStore();
  if (!store) {
    throw new Error("Branch context not found. Ensure the request is within a branch context.");
  }
  return store;
}
