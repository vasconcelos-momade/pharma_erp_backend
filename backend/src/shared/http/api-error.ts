export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundApiError extends ApiError {
  constructor(message = "Resource not found", details?: unknown) {
    super(message, 404, "RESOURCE_NOT_FOUND", details);
  }
}

export class ForbiddenApiError extends ApiError {
  constructor(message = "Access denied", details?: unknown) {
    super(message, 403, "ACCESS_DENIED", details);
  }
}

export class ValidationApiError extends ApiError {
  constructor(message = "Validation error", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class UnauthorizedApiError extends ApiError {
  constructor(message = "Authentication required", details?: unknown) {
    super(message, 401, "AUTH_UNAUTHORIZED", details);
  }
}
