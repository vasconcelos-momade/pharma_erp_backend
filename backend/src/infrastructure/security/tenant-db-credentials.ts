import { decryptCredential, encryptCredential } from "./credential-cipher";

export function requireEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key?.trim()) {
    throw new Error("ENCRYPTION_KEY não definida.");
  }
  return key;
}

export function encryptTenantDbPassword(plain: string) {
  return encryptCredential(plain, requireEncryptionKey());
}

export function decryptTenantDbPassword(
  cipherText: string,
  iv: string,
  tag?: string | null,
): string {
  return decryptCredential(cipherText, iv, requireEncryptionKey(), tag);
}
