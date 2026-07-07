import { type CentralPayload } from "../../infrastructure/auth/jwt.service";
import { prismaCentralUnscoped } from "../../infrastructure/prisma/prisma-central.service";
import { branchContext } from "../context/branch-context";
import { authenticateCentralRequest } from "./central-auth";
import { isSuperAdminRole } from "./central-auth-roles";

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

async function assertBranchBelongsToTenant(
  tenantId: string,
  branchId: string,
): Promise<void> {
  const branch = await prismaCentralUnscoped.branch.findUnique({
    where: { id: BigInt(branchId) },
    select: { tenantId: true, active: true },
  });

  if (!branch) {
    throw new TenantAuthError("Branch not found", 404);
  }
  if (String(branch.tenantId) !== String(tenantId)) {
    throw new TenantAuthError("Branch does not belong to tenant", 403);
  }
  if (!branch.active) {
    throw new TenantAuthError("Branch is not active", 403);
  }
}

export async function authenticateTenantRequest(req: Request): Promise<TenantAuthContext> {
  const auth = await authenticateCentralRequest(req);
  const requestedTenantId = req.headers.get("x-tenant-id");
  const requestedBranchId = req.headers.get("x-branch-id");

  // SUPER_ADMIN: não usa lista de tenants do JWT; exige headers explícitos.
  if (isSuperAdminRole(auth.role)) {
    if (!requestedTenantId || !requestedBranchId) {
      throw new TenantAuthError(
        "SUPER_ADMIN must provide x-tenant-id and x-branch-id for tenant routes",
        403,
      );
    }
    await assertBranchBelongsToTenant(requestedTenantId, requestedBranchId);
    return {
      payload: auth.payload,
      tenantId: requestedTenantId,
      branchId: requestedBranchId,
      userId: auth.userId,
      centralUserId: auth.userId,
    };
  }

  const selection = resolveTenantSelection(
    auth.payload,
    requestedTenantId,
    requestedBranchId,
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
