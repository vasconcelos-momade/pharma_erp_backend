declare module "node:process" {
  const processValue: {
    env: Record<string, string | undefined>;
    argv: string[];
    exit(code?: number): never;
  };
  export default processValue;
}

declare module "node:crypto" {
  export function createHash(algorithm: string): {
    update(data: string): { digest(encoding: string): string };
    update(data: Uint8Array): { digest(encoding: string): string };
    digest(encoding: string): string;
  };

  export function createHmac(algorithm: string, key: string): {
    update(data: string): { digest(encoding: string): string };
    digest(encoding: string): string;
  };

  export function timingSafeEqual(a: unknown, b: unknown): boolean;
}

declare module "crypto" {
  export function createHash(algorithm: string): {
    update(data: string): { digest(encoding: string): string };
    update(data: Uint8Array): { digest(encoding: string): string };
    digest(encoding: string): string;
  };

  export function createHmac(algorithm: string, key: string): {
    update(data: string): { digest(encoding: string): string };
    digest(encoding: string): string;
  };

  export function timingSafeEqual(a: unknown, b: unknown): boolean;
  export function randomUUID(): string;
  export function randomBytes(size: number): Buffer;
  export function createCipheriv(...args: unknown[]): {
    update(value: string, inputEncoding?: string, outputEncoding?: string): string;
    final(outputEncoding?: string): string;
    getAuthTag(): Buffer;
  };
  export function createDecipheriv(...args: unknown[]): {
    setAuthTag(tag: Buffer): void;
    update(value: string, inputEncoding?: string, outputEncoding?: string): string;
    final(outputEncoding?: string): string;
  };
}

declare module "node:fs" {
  export const promises: {
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    writeFile(path: string, data: string | Uint8Array): Promise<void>;
    readFile(path: string): Promise<Uint8Array>;
  };
}

declare module "node:path" {
  export function join(...parts: string[]): string;
}

declare module "@aws-sdk/client-s3" {
  export class S3Client {
    constructor(config?: Record<string, unknown>);
    send(command: unknown): Promise<any>;
  }

  export class PutObjectCommand {
    constructor(input: Record<string, unknown>);
  }

  export class GetObjectCommand {
    constructor(input: Record<string, unknown>);
  }
}

declare module "@aws-sdk/s3-request-presigner" {
  export function getSignedUrl(client: unknown, command: unknown, options?: Record<string, unknown>): Promise<string>;
}

declare module "qrcode" {
  export function toDataURL(input: string, options?: Record<string, unknown>): Promise<string>;
}

declare module "puppeteer" {
  export interface PDFOptions {
    format?: string;
    printBackground?: boolean;
    preferCSSPageSize?: boolean;
    margin?: Record<string, string>;
  }

  const puppeteer: {
    launch(options?: Record<string, unknown>): Promise<{
      newPage(): Promise<{
        setContent(html: string, options?: Record<string, unknown>): Promise<void>;
        pdf(options?: PDFOptions): Promise<Uint8Array>;
        close(): Promise<void>;
      }>;
      close(): Promise<void>;
    }>;
  };

  export default puppeteer;
}

declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  exit(code?: number): never;
};

declare class Buffer {
  static from(data: string, encoding?: string): Buffer;
  static from(data: Uint8Array): Buffer;
  static concat(buffers: Buffer[]): Buffer;
  static byteLength(data: string, encoding?: string): number;
  subarray(start?: number, end?: number): Buffer;
  toString(encoding?: string): string;
}
