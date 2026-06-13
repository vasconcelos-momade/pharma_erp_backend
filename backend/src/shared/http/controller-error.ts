import { ZodError, type ZodIssue } from "zod";
import { ApiError } from "./api-error";
import { failure } from "./api-response";
import { getValidationErrorMessage } from "./request-validation";

function validationDetailsFromZod(error: ZodError) {
  return error.issues.map((issue: ZodIssue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "body",
    message: issue.message,
  }));
}

export function controllerErrorResponse(error: unknown, fallbackStatus = 400): Response {
  if (error instanceof ApiError) {
    return failure(error.status, error.code, error.message, error.details);
  }

  if (error instanceof ZodError) {
    return failure(400, "VALIDATION_ERROR", "Dados inválidos", {
      issues: validationDetailsFromZod(error),
    });
  }

  if (error instanceof SyntaxError) {
    return failure(400, "INVALID_JSON", "JSON inválido");
  }

  return failure(
    fallbackStatus,
    fallbackStatus === 500 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST",
    getValidationErrorMessage(
      error,
      fallbackStatus === 500 ? "Erro interno do servidor" : "Dados inválidos",
    ),
  );
}
