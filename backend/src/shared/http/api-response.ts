import { serializeForJson } from "./serialize-json";

type StandardErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

type StandardSuccessPayload = {
  success: true;
  data: unknown;
  meta?: Record<string, unknown>;
};

type StandardFailurePayload = {
  success: false;
  error: StandardErrorPayload;
};

function toJsonHeaders(headers?: HeadersInit): Headers {
  const normalized = new Headers(headers);
  normalized.set("content-type", "application/json; charset=utf-8");
  normalized.set("x-api-standard", "true");
  return normalized;
}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(serializeForJson(body)), {
    status,
    headers: toJsonHeaders(headers),
  });
}

export function success(
  data: unknown,
  status = 200,
  meta?: Record<string, unknown>,
  headers?: HeadersInit,
): Response {
  const payload: StandardSuccessPayload = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  };

  return json(payload, status, headers);
}

export function failure(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  headers?: HeadersInit,
): Response {
  const payload: StandardFailurePayload = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };

  return json(payload, status, headers);
}

function isStandardPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;
  return typeof record.success === "boolean";
}

function codeFromStatus(status: number): string {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "AUTH_UNAUTHORIZED";
  if (status === 403) return "ACCESS_DENIED";
  if (status === 404) return "RESOURCE_NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_ERROR";
  if (status === 429) return "RATE_LIMIT_EXCEEDED";
  return "INTERNAL_SERVER_ERROR";
}

function extractErrorMessage(payload: unknown, fallback: string): { message: string; details?: unknown; code?: string } {
  if (typeof payload === "string" && payload.trim()) {
    return { message: payload.trim() };
  }

  if (!payload || typeof payload !== "object") {
    return { message: fallback };
  }

  const record = payload as Record<string, unknown>;
  const nestedError =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : null;

  if (nestedError) {
    return {
      message:
        typeof nestedError.message === "string"
          ? nestedError.message
          : typeof record.message === "string"
            ? record.message
            : fallback,
      details: nestedError.details,
      code: typeof nestedError.code === "string" ? nestedError.code : undefined,
    };
  }

  if (typeof record.error === "string") {
    return { message: record.error };
  }

  if (typeof record.message === "string") {
    return { message: record.message };
  }

  return { message: fallback, details: payload };
}

export async function normalizeResponse(response: Response): Promise<Response> {
  if (response.headers.get("x-api-standard") === "true") {
    return response;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const isBinaryResponse =
    contentDisposition.toLowerCase().includes("attachment") ||
    contentType.startsWith("application/pdf") ||
    contentType.startsWith("application/octet-stream") ||
    contentType.startsWith("image/") ||
    contentType.startsWith("audio/") ||
    contentType.startsWith("video/");

  if (isBinaryResponse) {
    return response;
  }

  if (response.status === 204) {
    const headers = toJsonHeaders(response.headers);
    return new Response(null, { status: 204, headers });
  }

  const cloned = response.clone();
  const bodyText = await cloned.text();
  const fallbackMessage = response.statusText || "Request failed";

  let parsedBody: unknown = bodyText;

  if (contentType.includes("application/json") && bodyText) {
    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      parsedBody = bodyText;
    }
  }

  if (isStandardPayload(parsedBody)) {
    return json(parsedBody, response.status, response.headers);
  }

  if (response.ok) {
    return success(parsedBody, response.status, undefined, response.headers);
  }

  const extracted = extractErrorMessage(parsedBody, fallbackMessage);

  return failure(
    response.status,
    extracted.code ?? codeFromStatus(response.status),
    extracted.message,
    extracted.details,
    response.headers,
  );
}
