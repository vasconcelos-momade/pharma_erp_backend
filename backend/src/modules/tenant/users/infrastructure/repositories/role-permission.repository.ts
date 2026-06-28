import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ComplianceAuditService } from "../../../../../shared/services/compliance-audit.service";
import {
  TENANT_PERMISSION_ROLES,
  listStandardActions,
  listStandardModules,
} from "../../../shared/permission.constants";

export class RolePermissionRepository {
  private audit = new ComplianceAuditService();

  private get prisma() {
    return getPrisma() as any;
  }

  async listRoles() {
    const counts = await this.prisma.user.groupBy({
      by: ["role"],
      where: { deletedAt: null },
      _count: { id: true },
    });

    const countMap = new Map(counts.map((c: any) => [c.role, c._count.id]));

    return TENANT_PERMISSION_ROLES.map((role) => ({
      role,
      userCount: countMap.get(role) ?? 0,
      description: this.roleDescription(role),
    }));
  }

  private roleDescription(role: string): string {
    const descriptions: Record<string, string> = {
      ADMIN: "Acesso total ao sistema",
      GERENTE: "Gestão operacional e relatórios",
      FARMACEUTICO: "Dispensação e receitas",
      DIRETOR_TECNICO: "Supervisão técnica e aprovações",
      CAIXA: "Operações de caixa e POS",
    };
    return descriptions[role] ?? role;
  }

  async getRoleDetail(role: string) {
    const [permissions, users] = await Promise.all([
      this.prisma.rolePermission.findMany({
        where: { role },
        orderBy: [{ module: "asc" }, { action: "asc" }],
      }),
      this.prisma.user.findMany({
        where: { role, deletedAt: null },
        select: { id: true, name: true, email: true, active: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      role,
      description: this.roleDescription(role),
      userCount: users.length,
      users: users.map((u: any) => ({
        id: u.id.toString(),
        name: u.name,
        email: u.email ?? null,
        active: Boolean(u.active),
      })),
      permissions: permissions.map((p: any) => ({
        id: p.id.toString(),
        module: p.module,
        action: p.action,
      })),
    };
  }

  async getPermissionMatrix(role?: string) {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      ...(role ? { where: { role } } : {}),
    });

    const roleMap = new Map<string, Set<string>>();
    for (const rp of rolePermissions) {
      const key = `${rp.role}:${rp.module}`;
      if (!roleMap.has(key)) roleMap.set(key, new Set());
      roleMap.get(key)!.add(rp.action);
    }

    const modules = listStandardModules();
    const actions = listStandardActions().filter((action) =>
      ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT"].includes(action),
    );

    const matrix = modules.map((module) => ({
      module,
      actions: Object.fromEntries(
        actions.map((action) => {
          if (!role) {
            const rolesWithAction = TENANT_PERMISSION_ROLES.filter((r) =>
              roleMap.get(`${r}:${module}`)?.has(action),
            );
            return [action, rolesWithAction];
          }
          return [action, roleMap.get(`${role}:${module}`)?.has(action) ?? false];
        }),
      ),
    }));

    return { modules: matrix, availableModules: modules, availableActions: actions };
  }

  async updateRolePermissions(
    role: string,
    grants: Array<{ module: string; action: string; enabled: boolean }>,
    actorId: bigint,
  ) {
    await this.prisma.$transaction(async (tx: any) => {
      for (const grant of grants) {
        const existing = await tx.rolePermission.findFirst({
          where: { role, module: grant.module, action: grant.action },
        });

        if (grant.enabled && !existing) {
          await tx.rolePermission.create({
            data: { role, module: grant.module, action: grant.action },
          });
          await this.audit.createImmutableLog(
            {
              userId: actorId,
              action: "PERMISSION_GRANT",
              entity: "RolePermission",
              after: { role, module: grant.module, action: grant.action },
            },
            tx,
          );
        } else if (!grant.enabled && existing) {
          await tx.rolePermission.delete({ where: { id: existing.id } });
          await this.audit.createImmutableLog(
            {
              userId: actorId,
              action: "PERMISSION_REVOKE",
              entity: "RolePermission",
              before: { role, module: grant.module, action: grant.action },
            },
            tx,
          );
        }
      }
    });
  }

  async updateUserPermissions(
    userId: bigint,
    permissions: Array<{
      module: string;
      action: string;
      allowed?: boolean;
      clear?: boolean;
    }>,
    actorId: bigint,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { role: true },
    });
    if (!user) throw new Error("Utilizador não encontrado");

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role: user.role },
    });
    const roleSet = new Set(
      rolePermissions.map((rp: { module: string; action: string }) => `${rp.module}:${rp.action}`),
    );

    await this.prisma.$transaction(async (tx: any) => {
      for (const perm of permissions) {
        const existing = await tx.userPermission.findFirst({
          where: { userId, module: perm.module, action: perm.action },
        });
        const roleHas = roleSet.has(`${perm.module}:${perm.action}`);

        if (perm.clear === true || perm.allowed === roleHas) {
          if (existing) {
            await tx.userPermission.delete({ where: { id: existing.id } });
            await this.audit.createImmutableLog(
              {
                userId: actorId,
                action: "USER_PERMISSION_CLEAR",
                entity: "UserPermission",
                entityId: userId,
                before: {
                  module: perm.module,
                  action: perm.action,
                  allowed: existing.allowed,
                },
              },
              tx,
            );
          }
          continue;
        }

        if (typeof perm.allowed !== "boolean") {
          continue;
        }

        if (existing) {
          await tx.userPermission.update({
            where: { id: existing.id },
            data: { allowed: perm.allowed },
          });
        } else {
          await tx.userPermission.create({
            data: {
              userId,
              module: perm.module,
              action: perm.action,
              allowed: perm.allowed,
            },
          });
        }

        await this.audit.createImmutableLog(
          {
            userId: actorId,
            action: perm.allowed ? "USER_PERMISSION_GRANT" : "USER_PERMISSION_DENY",
            entity: "UserPermission",
            entityId: userId,
            after: { module: perm.module, action: perm.action, allowed: perm.allowed },
          },
          tx,
        );
      }
    });
  }

  async getUserEffectivePermissions(userId: bigint) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { userPermissions: true },
    });
    if (!user) throw new Error("Utilizador não encontrado");

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role: user.role },
    });

    const effective = new Map<string, { allowed: boolean; source: string }>();

    for (const rp of rolePermissions) {
      effective.set(`${rp.module}:${rp.action}`, { allowed: true, source: "role" });
    }

    for (const up of user.userPermissions) {
      effective.set(`${up.module}:${up.action}`, {
        allowed: Boolean(up.allowed),
        source: "user_override",
      });
    }

    return {
      userId: userId.toString(),
      role: user.role,
      permissions: Array.from(effective.entries()).map(([key, val]) => {
        const [module, action] = key.split(":");
        return { module, action, ...val };
      }),
    };
  }

  async getDashboard() {
    const [roleCount, userOverrideCount, totalGrants] = await Promise.all([
      this.prisma.rolePermission.count(),
      this.prisma.userPermission.count(),
      this.prisma.rolePermission.groupBy({
        by: ["role"],
        _count: { id: true },
      }),
    ]);

    return {
      totalRoleGrants: roleCount,
      totalUserOverrides: userOverrideCount,
      grantsByRole: totalGrants.map((g: any) => ({
        role: g.role,
        count: g._count.id,
      })),
      availableRoles: TENANT_PERMISSION_ROLES,
      availableModules: TENANT_SYSTEM_MODULES,
      availableActions: TENANT_PERMISSION_ACTIONS,
    };
  }
}
