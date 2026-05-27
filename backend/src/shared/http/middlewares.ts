import { ApiError } from "./api-error";
import { normalizeResponse } from "./api-response";
import type { RouteContext, RouteMiddleware } from "./router";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  keyPrefix: string;
  windowMs: number;
  max: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

function getAllowedOrigins(): string[] {
  const configured = process.env.CORS_ALLOWED_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured && configured.length > 0) {
    return configured;
  }

  return [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "https://app.suaempresa.com",
  ];
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    return true;
  }

  if (getAllowedOrigins().includes(origin)) {
    return true;
  }

  // Flutter web e outros clients locais usam portas dinâmicas em desenvolvimento.
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction && isLocalDevOrigin(origin)) {
    return true;
  }

  return false;
}

function buildCorsHeaders(req: Request): Headers {
  const headers = new Headers();
  const origin = req.headers.get("origin");

  if (origin && isOriginAllowed(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-tenant-id, x-branch-id, x-user-id, x-request-id",
  );
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Max-Age", "86400");

  return headers;
}

function withSharedHeaders(req: Request, response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  const corsHeaders = buildCorsHeaders(req);

  corsHeaders.forEach((value, key) => {
    headers.set(key, value);
  });

  headers.set("x-request-id", requestId);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function createPreflightResponse(req: Request): Response {
  const origin = req.headers.get("origin");
  if (origin && !isOriginAllowed(origin)) {
    throw new ApiError("Origin não permitida por CORS", 403, "CORS_ORIGIN_DENIED");
  }

  return withSharedHeaders(req, new Response(null, { status: 204 }), req.headers.get("x-request-id") ?? crypto.randomUUID());
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  return req.headers.get("x-real-ip") ?? "unknown";
}

export const requestLifecycleMiddleware: RouteMiddleware = async (context, next) => {
  const requestId = context.req.headers.get("x-request-id") ?? context.requestId;
  context.requestId = requestId;
  context.state.requestId = requestId;

  const origin = context.req.headers.get("origin");
  if (origin && !isOriginAllowed(origin)) {
    throw new ApiError("Origin não permitida por CORS", 403, "CORS_ORIGIN_DENIED");
  }

  const startedAt = Date.now();
  console.info(`[http] ${context.req.method} ${context.url.pathname} requestId=${requestId}`);

  const response = await next();
  const normalized = await normalizeResponse(response);
  const finalized = withSharedHeaders(context.req, normalized, requestId);

  console.info(
    `[http] ${context.req.method} ${context.url.pathname} status=${finalized.status} durationMs=${Date.now() - startedAt} requestId=${requestId}`,
  );

  return finalized;
};

export const auditMiddleware: RouteMiddleware = async (context, next) => {
  const response = await next();

  if (["POST", "PUT", "PATCH", "DELETE"].includes(context.req.method)) {
    const actor =
      (context.state.tenantAuth as { userId?: string } | undefined)?.userId ??
      (context.state.centralAuth as { userId?: string } | undefined)?.userId ??
      "anonymous";

    console.info(
      `[audit] method=${context.req.method} path=${context.url.pathname} actor=${actor} status=${response.status} requestId=${context.requestId}`,
    );
  }

  return response;
};

export function createRateLimitMiddleware(options: RateLimitOptions): RouteMiddleware {
  return async (context: RouteContext, next) => {
    const now = Date.now();
    const clientIp = getClientIp(context.req);
    const key = `${options.keyPrefix}:${clientIp}`;
    const current = rateLimitStore.get(key);

    if (!current || current.resetAt <= now) {
      rateLimitStore.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      return next();
    }

    if (current.count >= options.max) {
      throw new ApiError(
        "Limite de requisições excedido. Tente novamente mais tarde.",
        429,
        "RATE_LIMIT_EXCEEDED",
        {
          retryAfterMs: current.resetAt - now,
        },
      );
    }

    current.count += 1;
    rateLimitStore.set(key, current);

    return next();
  };
}
