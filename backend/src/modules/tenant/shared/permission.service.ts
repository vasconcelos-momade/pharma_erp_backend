import type { PrismaClient as PrismaTenantClient } from "../../../infrastructure/prisma/tenant/generated/tenant";
import { getPrisma } from "../../../infrastructure/prisma/tenant-prisma.factory";
import { ForbiddenApiError } from "../../../shared/http/api-error";
import {
  ACTION_PERMISSION_ALIASES,
  MODULE_PERMISSION_ALIASES,
  type TenantPermissionAction,
  type TenantSystemModule,
  isCriticalPermissionAction,
} from "./permission.constants";

type PermissionPrisma = Pick<
  PrismaTenantClient,
  "user" | "userPermission" | "rolePermission"
>;

export type PermissionSource =
  | "user_permissions"
  | "role_permissions"
  | "none";

export type PermissionDecision = {
  allowed: boolean;
  source: PermissionSource;
  role: string | null;
  matchedModule: string | null;
  matchedAction: string | null;
};

export class PermissionService {
  constructor(private readonly prisma: PermissionPrisma = getPrisma()) {}

  async resolvePermission(
    userId: string | bigint,
    module: TenantSystemModule,
    action: TenantPermissionAction,
  ): Promise<PermissionDecision> {
    const normalizedUserId = BigInt(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: normalizedUserId },
      select: {
        id: true,
        role: true,
        active: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt || !user.active) {
      throw new ForbiddenApiError("Utilizador inactivo ou sem acesso ao tenant");
    }

    const moduleCandidates = MODULE_PERMISSION_ALIASES[module] ?? [module];
    const actionCandidates = ACTION_PERMISSION_ALIASES[action] ?? [action];

    const userPermission = await this.prisma.userPermission.findFirst({
      where: {
        userId: normalizedUserId,
        module: { in: [...moduleCandidates] as any[] },
        action: { in: [...actionCandidates] as any[] },
      },
      orderBy: { id: "desc" },
    });

    if (userPermission) {
      return {
        allowed: Boolean(userPermission.allowed),
        source: "user_permissions",
        role: String(user.role),
        matchedModule: String(userPermission.module),
        matchedAction: String(userPermission.action),
      };
    }

    const rolePermission = await this.prisma.rolePermission.findFirst({
      where: {
        role: user.role,
        module: { in: [...moduleCandidates] as any[] },
        action: { in: [...actionCandidates] as any[] },
      },
      orderBy: { id: "desc" },
    });

    if (rolePermission) {
      return {
        allowed: true,
        source: "role_permissions",
        role: String(user.role),
        matchedModule: String(rolePermission.module),
        matchedAction: String(rolePermission.action),
      };
    }

    return {
      allowed: false,
      source: "none",
      role: String(user.role),
      matchedModule: null,
      matchedAction: null,
    };
  }

  async hasPermission(
    userId: string | bigint,
    module: TenantSystemModule,
    action: TenantPermissionAction,
  ): Promise<boolean> {
    const decision = await this.resolvePermission(userId, module, action);
    return decision.allowed;
  }

  async assertPermission(
    userId: string | bigint,
    module: TenantSystemModule,
    action: TenantPermissionAction,
    message?: string,
  ): Promise<PermissionDecision> {
    const decision = await this.resolvePermission(userId, module, action);
    if (!decision.allowed) {
      throw new ForbiddenApiError(
        message ?? `Acesso negado para ${module}:${action}`,
        {
          module,
          action,
          source: decision.source,
          role: decision.role,
        },
      );
    }
    return decision;
  }

  isCriticalAction(action: TenantPermissionAction): boolean {
    return isCriticalPermissionAction(action);
  }
}
