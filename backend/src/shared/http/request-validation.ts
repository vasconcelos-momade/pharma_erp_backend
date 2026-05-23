import { ZodError } from "zod";

export async function parseJsonBody<T>(
  req: Request,
  schema: { parse(data: unknown): T },
): Promise<T> {
  const payload = await req.json();
  return schema.parse(payload);
}

export function parseSearchParams<T>(
  url: URL,
  schema: { parse(data: unknown): T },
): T {
  return schema.parse(Object.fromEntries(url.searchParams.entries()));
}

export function parseRouteParams<T>(
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
