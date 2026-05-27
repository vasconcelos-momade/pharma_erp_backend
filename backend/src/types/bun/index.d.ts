declare module "bun" {
  export class RedisClient {
    constructor(url?: string);
    lpush(key: string, value: string): Promise<number>;
    brpop(key: string, timeout: number): Promise<[string, string] | null>;
  }
}

declare module "bun:test" {
  export function describe(
    name: string,
    fn: () => void | Promise<void>,
  ): void;
  export function test(
    name: string,
    fn: () => void | Promise<void>,
  ): void;
  export function expect<T = unknown>(value: T): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toContain(expected: unknown): void;
  };
}
