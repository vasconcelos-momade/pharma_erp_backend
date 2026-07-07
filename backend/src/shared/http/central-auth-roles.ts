import { Role } from "../../infrastructure/prisma/central/generated/central";

export type NormalizedCentralRole = "SUPER_ADMIN" | "TENANT_ADMIN" | "TENANT_USER";

export function normalizeCentralRole(role: Role | string): NormalizedCentralRole {
  const value = String(role).toLowerCase();
  if (value === "superadmin" || value === "super_admin") {
    return "SUPER_ADMIN";
  }
  if (value === "admin" || value === "tenant_admin") {
    return "TENANT_ADMIN";
  }
  return "TENANT_USER";
}

export function isSuperAdminRole(role: Role | string): boolean {
  return normalizeCentralRole(role) === "SUPER_ADMIN";
}

export function isTenantRole(role: Role | string): boolean {
  return !isSuperAdminRole(role);
}

/** Papéis tenant (admin/usuario) exigem tenant+branch em rotas /tenant/* e /app/*. */
export function requiresTenantContext(role: Role | string): boolean {
  return isTenantRole(role);
}

export function assertPlatformOnlyRole(role: Role | string): void {
  if (!isSuperAdminRole(role)) {
    throw new Error("SUPER_ADMIN role required");
  }
}
