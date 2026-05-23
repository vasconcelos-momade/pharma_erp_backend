import { ZodError } from "zod";
import { failure } from "./api-response";
import { ApiError } from "./api-error";
import { CentralAuthError } from "./central-auth";
import { TenantAuthError } from "./tenant-auth";
import { WebhookAuthError } from "./webhook-auth";
import { SyncValidationError } from "../../infrastructure/sync/central-sync.service";

function validationDetailsFromZod(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "body",
    message: issue.message,
  }));
}

export function globalErrorHandler(error: unknown, requestId?: string): Response {
  if (error instanceof ApiError) {
    return failure(error.status, error.code, error.message, {
      ...(error.details !== undefined ? { details: error.details } : {}),
      ...(requestId ? { requestId } : {}),
    });
  }

  if (error instanceof ZodError) {
    return failure(400, "VALIDATION_ERROR", "Dados inválidos", {
      issues: validationDetailsFromZod(error),
      ...(requestId ? { requestId } : {}),
    });
  }

  if (error instanceof CentralAuthError) {
    return failure(error.status, error.status === 401 ? "AUTH_UNAUTHORIZED" : "ACCESS_DENIED", error.message, {
      ...(requestId ? { requestId } : {}),
    });
  }

  if (error instanceof TenantAuthError) {
    return failure(error.status, error.status === 401 ? "AUTH_UNAUTHORIZED" : "TENANT_ACCESS_DENIED", error.message, {
      ...(requestId ? { requestId } : {}),
    });
  }

  if (error instanceof WebhookAuthError) {
    return failure(error.status, "WEBHOOK_UNAUTHORIZED", error.message, {
      ...(requestId ? { requestId } : {}),
    });
  }

  if (error instanceof SyncValidationError) {
    return failure(400, "SYNC_VALIDATION_ERROR", error.message, {
      ...(requestId ? { requestId } : {}),
    });
  }

  if (error instanceof SyntaxError) {
    return failure(400, "INVALID_JSON", "JSON inválido", {
      ...(requestId ? { requestId } : {}),
    });
  }

  console.error("Erro não tratado na API:", error);

  return failure(500, "INTERNAL_SERVER_ERROR", "Erro interno do servidor", {
    ...(requestId ? { requestId } : {}),
  });
}
