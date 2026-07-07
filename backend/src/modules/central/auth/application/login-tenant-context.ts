import { Role } from "../../../../infrastructure/prisma/central/generated/central";
import { TenantPrismaFactory } from "../../../../infrastructure/prisma/tenant-prisma.factory";
import { prismaCentralUnscoped } from "../../../../infrastructure/prisma/prisma-central.service";
import { RolePermissionRepository } from "../../../tenant/users/infrastructure/repositories/role-permission.repository";
import { resolveTenantUserId } from "../../../tenant/shared/resolve-tenant-user";
import { branchContext } from "../../../../shared/context/branch-context";
import {
  isSuperAdminRole,
  normalizeCentralRole,
  type NormalizedCentralRole,
} from "../../../../shared/http/central-auth-roles";

export interface LoginPermissionEntry {
  module: string;
  action: string;
  allowed: boolean;
  source: string;
}

export interface LoginTenantContext {
  role: NormalizedCentralRole;
  tenantId: string | null;
  branchId: string | null;
  permissions: LoginPermissionEntry[];
  redirectTo: string;
}

interface TenantShape {
  id: string;
  branches: { id: string }[];
}

function hasSingleTenantBranch(tenants: TenantShape[]): boolean {
  return tenants.length === 1 && (tenants[0]?.branches?.length ?? 0) === 1;
}

async function loadTenantPermissions(input: {
  centralUserId: string;
  email: string;
  tenantId: string;
  branchId: string;
}): Promise<LoginPermissionEntry[]> {
  const branch = await prismaCentralUnscoped.branch.findUnique({
    where: { id: BigInt(input.branchId) },
    include: {
      tenant: { select: { id: true, status: true } },
    },
  });

  if (!branch || String(branch.tenantId) !== String(input.tenantId)) {
    return [];
  }
  if (!["trial", "ativo", "grace"].includes(String(branch.tenant.status))) {
    return [];
  }
  if (!branch.active) {
    return [];
  }

  return branchContext.run(
    {
      tenantId: input.tenantId,
      branchId: input.branchId,
      dbName: branch.dbName,
      dbHost: branch.dbHost,
      dbPort: branch.dbPort,
      dbUsername: branch.dbUsername,
      dbPasswordCipherText: branch.dbPasswordCipherText,
      dbPasswordIv: branch.dbPasswordIv,
      dbPasswordTag: branch.dbPasswordTag,
    },
    async () => {
      const prisma = TenantPrismaFactory.getClient();
      const tenantUserId = await resolveTenantUserId(prisma, {
        centralUserId: input.centralUserId,
        email: input.email,
      });
      const repo = new RolePermissionRepository();
      const effective = await repo.getUserEffectivePermissions(tenantUserId);
      return effective.permissions.map((entry) => ({
        module: String(entry.module),
        action: String(entry.action),
        allowed: Boolean(entry.allowed),
        source: String(entry.source),
      }));
    },
  );
}

export async function resolveLoginTenantContext(input: {
  role: Role;
  userId: string;
  email: string;
  tenants: TenantShape[];
}): Promise<LoginTenantContext> {
  const normalizedRole = normalizeCentralRole(input.role);

  if (isSuperAdminRole(input.role)) {
    return {
      role: normalizedRole,
      tenantId: null,
      branchId: null,
      permissions: [],
      redirectTo: "/platform/dashboard",
    };
  }

  if (!hasSingleTenantBranch(input.tenants)) {
    return {
      role: normalizedRole,
      tenantId: null,
      branchId: null,
      permissions: [],
      redirectTo: "/auth/tenant-selection",
    };
  }

  const tenantId = input.tenants[0]!.id;
  const branchId = input.tenants[0]!.branches[0]!.id;

  let permissions: LoginPermissionEntry[] = [];
  try {
    permissions = await loadTenantPermissions({
      centralUserId: input.userId,
      email: input.email,
      tenantId,
      branchId,
    });
  } catch {
    permissions = [];
  }

  return {
    role: normalizedRole,
    tenantId,
    branchId,
    permissions,
    redirectTo: "/app/dashboard",
  };
}
