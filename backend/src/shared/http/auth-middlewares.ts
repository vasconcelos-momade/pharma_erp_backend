import {
  assertSuperadmin,
  assertTenantAccess,
  authenticateCentralRequest,
  type CentralAuthContext,
} from "./central-auth";
import { getPrisma } from "../../infrastructure/prisma/tenant-prisma.factory";
import { resolveTenantUserId, TenantUserNotFoundError } from "../../modules/tenant/shared/resolve-tenant-user";
import {
  authenticateTenantRequest,
  runWithTenantBranchContext,
  type TenantAuthContext,
} from "./tenant-auth";
import { assertWebhookSignature } from "./webhook-auth";
import { UnauthorizedApiError } from "./api-error";
import type { RouteContext, RouteMiddleware } from "./router";

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
    assertTenantAccess(requireCentralAuthFromState(context), context.params[paramName]);
    return next();
  };
}

export function tenantAuthMiddleware(): RouteMiddleware {
  return async (context, next) => {
    const auth = await authenticateTenantRequest(context.req);
    context.state.tenantAuth = auth;
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
