import {
  assertSuperadmin,
  assertTenantAccess,
  authenticateCentralRequest,
  type CentralAuthContext,
  isSuperAdminRole,
  requiresTenantContext,
} from "./central-auth";
import { getPrisma } from "../../infrastructure/prisma/tenant-prisma.factory";
import { resolveTenantUserId, TenantUserNotFoundError } from "../../modules/tenant/shared/resolve-tenant-user";
import {
  authenticateTenantRequest,
  runWithTenantBranchContext,
  type TenantAuthContext,
} from "./tenant-auth";
import { assertWebhookSignature } from "./webhook-auth";
import { ForbiddenApiError, UnauthorizedApiError } from "./api-error";
import type { RouteContext, RouteMiddleware } from "./router";
import {
  type TenantPermissionAction,
  type TenantSystemModule,
} from "../../modules/tenant/shared/permission.constants";
import {
  type PermissionDecision,
  PermissionService,
} from "../../modules/tenant/shared/permission.service";
import { ComplianceAuditService } from "../services/compliance-audit.service";

function requireCentralAuthFromState(context: RouteContext): CentralAuthContext {
  const auth = context.state.centralAuth as CentralAuthContext | undefined;
  if (!auth) {
    throw new UnauthorizedApiError("Autenticação central obrigatória");
  }

  return auth;
}

function requireTenantAuthFromState(context: RouteContext): TenantAuthContext {
  const auth = context.state.tenantAuth as TenantAuthContext | undefined;
  if (!auth) {
    throw new UnauthorizedApiError("Autenticação tenant obrigatória");
  }

  return auth;
}

export function getCentralAuth(context: RouteContext): CentralAuthContext {
  return requireCentralAuthFromState(context);
}

export function getOptionalCentralAuth(context: RouteContext): CentralAuthContext | null {
  return (context.state.centralAuth as CentralAuthContext | undefined) ?? null;
}

export function getTenantAuth(context: RouteContext): TenantAuthContext {
  return requireTenantAuthFromState(context);
}

export type TenantRoutePermissionContext = PermissionDecision & {
  module: TenantSystemModule;
  action: TenantPermissionAction;
};

export function getRequiredTenantPermission(
  context: RouteContext,
): TenantRoutePermissionContext | null {
  return (
    context.state.requiredTenantPermission as TenantRoutePermissionContext | undefined
  ) ?? null;
}

export function getRawBody(context: RouteContext): string {
  return String(context.state.rawBody ?? "");
}

export function centralAuthMiddleware(): RouteMiddleware {
  return async (context, next) => {
    const auth = await authenticateCentralRequest(context.req);
    context.state.centralAuth = auth;
    return next();
  };
}

export function optionalCentralAuthMiddleware(): RouteMiddleware {
  return async (context, next) => {
    const authorization = context.req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      context.state.centralAuth = null;
      return next();
    }

    const auth = await authenticateCentralRequest(context.req);
    context.state.centralAuth = auth;
    return next();
  };
}

export function superadminMiddleware(): RouteMiddleware {
  return async (context, next) => {
    assertSuperadmin(requireCentralAuthFromState(context));
    return next();
  };
}

export function tenantAccessMiddleware(paramName = "tenantId"): RouteMiddleware {
  return async (context, next) => {
    const auth = requireCentralAuthFromState(context);
    // SUPER_ADMIN ignora obrigatoriedade de tenant no JWT
    if (!isSuperAdminRole(auth.role)) {
      assertTenantAccess(auth, context.params[paramName]);
    }
    return next();
  };
}

/** Exige contexto tenant para papéis tenant; SUPER_ADMIN passa sem validação JWT. */
export function requireTenantMiddleware(paramName = "tenantId"): RouteMiddleware {
  return tenantAccessMiddleware(paramName);
}

/** Rotas exclusivas da plataforma — apenas SUPER_ADMIN. */
export function platformAdminMiddleware(): RouteMiddleware {
  return superadminMiddleware();
}

export function tenantAuthMiddleware(): RouteMiddleware {
  return async (context, next) => {
    const auth = await authenticateTenantRequest(context.req);
    context.state.tenantAuth = auth;
    return next();
  };
}

/** Bloqueia utilizadores tenant sem headers de contexto em rotas que exigem tenant. */
export function requireTenantHeadersMiddleware(): RouteMiddleware {
  return async (context, next) => {
    const auth = requireCentralAuthFromState(context);
    if (!requiresTenantContext(auth.role)) {
      return next();
    }
    const tenantId = context.req.headers.get("x-tenant-id");
    const branchId = context.req.headers.get("x-branch-id");
    if (!tenantId || !branchId) {
      throw new ForbiddenApiError("Contexto tenant obrigatório (x-tenant-id, x-branch-id)");
    }
    return next();
  };
}

export function tenantBranchContextMiddleware(): RouteMiddleware {
  return async (context, next) => {
    const auth = requireTenantAuthFromState(context);
    const response = await runWithTenantBranchContext(auth.tenantId, auth.branchId, async () => {
      try {
        const tenantUserId = await resolveTenantUserId(getPrisma(), {
          centralUserId: auth.centralUserId,
          email: auth.payload.email,
        });

        context.state.tenantAuth = {
          ...auth,
          userId: tenantUserId.toString(),
        } satisfies TenantAuthContext;
      } catch (error) {
        if (error instanceof TenantUserNotFoundError) {
          throw new UnauthorizedApiError(error.message);
        }
        throw error;
      }

      const result = await next();
      if (!result) {
        throw new Error("A rota autenticada não retornou resposta.");
      }
      return result;
    });
    if (!response) {
      throw new Error("A rota autenticada não retornou resposta.");
    }
    return response;
  };
}

async function writePermissionAuditLog(input: {
  userId: string;
  module: TenantSystemModule;
  action: TenantPermissionAction;
  allowed: boolean;
  source: string;
  requestId: string;
  path: string;
  method: string;
  status?: number;
  role?: string | null;
}) {
  try {
    const auditService = new ComplianceAuditService();
    await auditService.createImmutableLog({
      userId: input.userId,
      action: input.allowed ? "AUTHORIZATION_GRANTED" : "AUTHORIZATION_DENIED",
      entity: "Permission",
      after: {
        module: input.module,
        permissionAction: input.action,
        allowed: input.allowed,
        source: input.source,
        role: input.role ?? null,
        method: input.method,
        path: input.path,
        status: input.status ?? null,
        requestId: input.requestId,
      },
    });
  } catch (error) {
    console.error("Falha ao persistir auditoria de permissao:", error);
  }
}

export function requirePermission(
  module: TenantSystemModule,
  action: TenantPermissionAction,
): RouteMiddleware {
  return async (context, next) => {
    const auth = requireTenantAuthFromState(context);
    const service = new PermissionService();
    const decision = await service.resolvePermission(auth.userId, module, action);

    context.state.requiredTenantPermission = {
      ...decision,
      module,
      action,
    } satisfies TenantRoutePermissionContext;

    if (!decision.allowed) {
      await writePermissionAuditLog({
        userId: auth.userId,
        module,
        action,
        allowed: false,
        source: decision.source,
        role: decision.role,
        requestId: context.requestId,
        method: context.req.method,
        path: context.url.pathname,
        status: 403,
      });

      throw new ForbiddenApiError(`Acesso negado para ${module}:${action}`, {
        module,
        action,
        source: decision.source,
        role: decision.role,
      });
    }

    const response = await next();

    if (service.isCriticalAction(action) && response.status < 400) {
      await writePermissionAuditLog({
        userId: auth.userId,
        module,
        action,
        allowed: true,
        source: decision.source,
        role: decision.role,
        requestId: context.requestId,
        method: context.req.method,
        path: context.url.pathname,
        status: response.status,
      });
    }

    return response;
  };
}

export function webhookSignatureMiddleware(providerParam = "provider"): RouteMiddleware {
  return async (context, next) => {
    const rawBody = await context.req.clone().text();
    assertWebhookSignature(context.params[providerParam], context.req, rawBody);
    context.state.rawBody = rawBody;
    return next();
  };
}
