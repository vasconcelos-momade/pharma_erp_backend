import { ZodError } from "zod";

export async function parseJsonBody<T = any>(
  req: Request,
  schema: { parse(data: unknown): T },
): Promise<T> {
  const payload = await req.json();
  return schema.parse(payload);
}

export function parseSearchParams<T = any>(
  url: URL,
  schema: { parse(data: unknown): T },
): T {
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return schema.parse(params);
}

export function parseRouteParams<T = any>(
  params: Record<string, string>,
  schema: { parse(data: unknown): T },
): T {
  return schema.parse(params);
}

export function getValidationErrorMessage(error: unknown, fallback = "Dados inválidos"): string {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "body";
        return `${path}: ${issue.message}`;
      })
      .join("; ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function isValidationError(error: unknown): boolean {
  return error instanceof ZodError;
}
