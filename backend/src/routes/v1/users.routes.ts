import { z } from "zod";
import { UserController } from "../../modules/tenant/users";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  getTenantAuth,
  requirePermission,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import { parseRouteParams } from "../../shared/http/request-validation";
import type { Router } from "../../shared/http/router";

const controller = new UserController();

const userIdParamSchema = z.object({
  userId: z.string().regex(/^\d+$/, "userId inválido"),
});

const roleParamSchema = z.object({
  role: z.string().trim().min(1),
});

export function registerUsersRoutes(router: Router, prefix: string): void {
  const base = `${prefix}/tenant/users`;
  const basePt = `${prefix}/tenant/utilizadores`;

  for (const path of [base, basePt]) {
    router.get(
      path,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("UTILIZADORES", "VIEW"),
      async (context) => controller.search(context.req),
    );

    router.post(
      path,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("UTILIZADORES", "CREATE"),
      auditMiddleware,
      async (context) => controller.create(context.req, getTenantAuth(context).userId),
    );

    router.get(
      `${path}/dashboard`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("UTILIZADORES", "VIEW"),
      async () => controller.dashboard(),
    );

    router.get(
      `${path}/me/permissoes`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      async (context) => controller.getUserEffectivePermissions(getTenantAuth(context).userId),
    );

    router.get(
      `${path}/:userId`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("UTILIZADORES", "VIEW"),
      async (context) => {
        const { userId } = parseRouteParams(context.params, userIdParamSchema);
        return controller.get(userId);
      },
    );

    router.put(
      `${path}/:userId`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("UTILIZADORES", "UPDATE"),
      auditMiddleware,
      async (context) => {
        const { userId } = parseRouteParams(context.params, userIdParamSchema);
        return controller.update(userId, context.req, getTenantAuth(context).userId);
      },
    );

    router.delete(
      `${path}/:userId`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("UTILIZADORES", "DELETE"),
      auditMiddleware,
      async (context) => {
        const { userId } = parseRouteParams(context.params, userIdParamSchema);
        return controller.delete(userId, getTenantAuth(context).userId);
      },
    );

    router.get(
      `${path}/:userId/auditoria`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("UTILIZADORES", "VIEW"),
      async (context) => {
        const { userId } = parseRouteParams(context.params, userIdParamSchema);
        return controller.listAudit(context.req, userId);
      },
    );

    router.get(
      `${path}/:userId/eventos`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("UTILIZADORES", "VIEW"),
      async (context) => {
        const { userId } = parseRouteParams(context.params, userIdParamSchema);
        return controller.listEvents(context.req, userId);
      },
    );

    router.get(
      `${path}/:userId/permissoes`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("UTILIZADORES", "VIEW"),
      async (context) => {
        const { userId } = parseRouteParams(context.params, userIdParamSchema);
        return controller.getUserEffectivePermissions(userId);
      },
    );

    router.put(
      `${path}/:userId/permissoes`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("UTILIZADORES", "UPDATE"),
      auditMiddleware,
      async (context) => {
        const { userId } = parseRouteParams(context.params, userIdParamSchema);
        return controller.updateUserPermissions(
          userId,
          context.req,
          getTenantAuth(context).userId,
        );
      },
    );
  }

  const rolesBase = `${prefix}/tenant/perfis`;
  const rolesBaseEn = `${prefix}/tenant/roles`;

  for (const path of [rolesBase, rolesBaseEn]) {
    router.get(
      path,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("UTILIZADORES", "VIEW"),
      async () => controller.listRoles(),
    );

    router.get(
      `${path}/:role`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("UTILIZADORES", "VIEW"),
      async (context) => {
        const { role } = parseRouteParams(context.params, roleParamSchema);
        return controller.getRoleDetail(role);
      },
    );

    router.put(
      `${path}/:role/permissoes`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("UTILIZADORES", "UPDATE"),
      auditMiddleware,
      async (context) => {
        const { role } = parseRouteParams(context.params, roleParamSchema);
        return controller.updateRolePermissions(
          role,
          context.req,
          getTenantAuth(context).userId,
        );
      },
    );
  }

  const permBase = `${prefix}/tenant/permissoes`;
  const permBaseEn = `${prefix}/tenant/permissions`;

  for (const path of [permBase, permBaseEn]) {
    router.get(
      path,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("UTILIZADORES", "VIEW"),
      async (context) => controller.getPermissionMatrix(context.req),
    );

    router.get(
      `${path}/dashboard`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("UTILIZADORES", "VIEW"),
      async () => controller.permissionsDashboard(),
    );
  }
}
