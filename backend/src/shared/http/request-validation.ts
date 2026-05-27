import { ZodError } from "zod";

type ParsableSchema = {
  parse(data: unknown): unknown;
};

export async function parseJsonBody<T>(
  req: Request,
  schema: ParsableSchema,
): Promise<T> {
  const payload = await req.json();
  return schema.parse(payload) as T;
}

export function parseSearchParams<T>(
  url: URL,
  schema: ParsableSchema,
): T {
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return schema.parse(params) as T;
}

export function parseRouteParams<T>(
  params: Record<string, string>,
  schema: ParsableSchema,
): T {
  return schema.parse(params) as T;
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
