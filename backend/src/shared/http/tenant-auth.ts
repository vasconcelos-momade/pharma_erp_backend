import { type CentralPayload } from "../../infrastructure/auth/jwt.service";
import { prismaCentralUnscoped } from "../../infrastructure/prisma/prisma-central.service";
import { branchContext } from "../context/branch-context";
import { authenticateCentralRequest } from "./central-auth";

export class TenantAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TenantAuthError";
  }
}

export interface TenantAuthContext {
  payload: CentralPayload;
  tenantId: string;
  branchId: string;
  /** `users.id` na base tenant (FK local). */
  userId: string;
  /** `users.id` na base central (JWT `sub`). */
  centralUserId: string;
}

export function resolveTenantSelection(
  payload: CentralPayload,
  requestedTenantId: string | null,
  requestedBranchId: string | null,
) {
  const tenantAccess = requestedTenantId
    ? payload.tenants.find((tenant) => tenant.id === requestedTenantId)
    : payload.tenants[0];

  if (!tenantAccess) {
    return null;
  }

  const branchAccess = requestedBranchId
    ? tenantAccess.branches?.find((branch) => branch.id === requestedBranchId)
    : tenantAccess.branches?.[0];

  if (!branchAccess) {
    return null;
  }

  return {
    tenantId: tenantAccess.id,
    branchId: branchAccess.id,
  };
}

export async function authenticateTenantRequest(req: Request): Promise<TenantAuthContext> {
  const auth = await authenticateCentralRequest(req);
  const selection = resolveTenantSelection(
    auth.payload,
    req.headers.get("x-tenant-id"),
    req.headers.get("x-branch-id"),
  );

  if (!selection) {
    throw new TenantAuthError("Access denied to this tenant or branch", 403);
  }

  return {
    payload: auth.payload,
    tenantId: selection.tenantId,
    branchId: selection.branchId,
    userId: auth.userId,
    centralUserId: auth.userId,
  };
}

export async function runWithTenantBranchContext(
  tenantId: string,
  branchId: string,
  fn: () => Promise<Response | null>,
): Promise<Response | null> {
  const branch = await prismaCentralUnscoped.branch.findUnique({
    where: { id: BigInt(branchId) },
    include: {
      tenant: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!branch) {
    throw new TenantAuthError("Branch not found", 404);
  }
  if (String(branch.tenantId) !== String(tenantId)) {
    throw new TenantAuthError("Branch does not belong to tenant", 403);
  }
  if (!["trial", "ativo", "grace"].includes(String(branch.tenant.status))) {
    throw new TenantAuthError("Tenant is not active", 403);
  }
  if (!branch.active) {
    throw new TenantAuthError("Branch is not active", 403);
  }

  return branchContext.run({
    tenantId: String(tenantId),
    branchId: String(branchId),
    dbName: branch.dbName,
    dbHost: branch.dbHost,
    dbPort: branch.dbPort,
    dbUsername: branch.dbUsername,
    dbPasswordCipherText: branch.dbPasswordCipherText,
    dbPasswordIv: branch.dbPasswordIv,
    dbPasswordTag: branch.dbPasswordTag,
  }, fn);
}

export async function withAuthenticatedTenantBranchContext(
  req: Request,
  handler: (context: TenantAuthContext) => Promise<Response | null>,
): Promise<Response | null> {
  const auth = await authenticateTenantRequest(req);
  return runWithTenantBranchContext(auth.tenantId, auth.branchId, () => handler(auth));
}
