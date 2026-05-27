/**
 * Shim para o IDE quando `node_modules/zod` não está no host.
 * Runtime usa o pacote real do container (`bun install` no Docker).
 * No host: `cd backend && bun install` remove a necessidade deste ficheiro.
 */
declare module "zod" {
  export const z: {
    string: () => ZodType;
    number: () => ZodType;
    boolean: () => ZodType;
    object: (shape: Record<string, ZodType>) => ZodType;
    array: (schema: ZodType) => ZodType;
    enum: (values: readonly [string, ...string[]]) => ZodType;
    coerce: {
      number: () => ZodType;
      boolean: () => ZodType;
    };
    looseObject: (shape: Record<string, ZodType>) => ZodType;
    infer<T extends ZodType>(schema: T): unknown;
  };

  export class ZodError extends Error {
    issues: Array<{ path: (string | number)[]; message: string }>;
  }

  export interface ZodType {
    parse(data: unknown): unknown;
    optional(): ZodType;
    partial(): ZodType;
    refine(
      check: (data: unknown) => boolean,
      params?: { message?: string },
    ): ZodType;
    min(length: number): ZodType;
    max(length: number): ZodType;
    trim(): ZodType;
    regex(pattern: RegExp, message?: string): ZodType;
    transform<T>(fn: (value: unknown) => T): ZodType;
    nonnegative(): ZodType;
    positive(): ZodType;
    int(): ZodType;
  }
}
