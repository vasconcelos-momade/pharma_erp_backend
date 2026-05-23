import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function resolveKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  return Buffer.from(trimmed.padEnd(32, "0").slice(0, 32), "utf8");
}

export function encryptCredential(
  plaintext: string,
  encryptionKey: string,
): { cipherText: string; iv: string; tag: string } {
  const key = resolveKey(encryptionKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    cipherText: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptCredential(
  cipherText: string,
  iv: string,
  encryptionKey: string,
  tag?: string | null,
): string {
  const key = resolveKey(encryptionKey);
  const ivBuffer = Buffer.from(iv, "base64");

  let data: Buffer;
  let authTag: Buffer;

  if (tag?.length) {
    data = Buffer.from(cipherText, "base64");
    authTag = Buffer.from(tag, "base64");
  } else {
    // Legado: auth tag embutido no final do cipherText
    const payload = Buffer.from(cipherText, "base64");
    authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
    data = payload.subarray(0, payload.length - AUTH_TAG_LENGTH);
  }

  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function isEncryptedCredential(
  cipherText: string,
  iv: string,
  tag?: string | null,
): boolean {
  return Boolean(cipherText?.length && iv?.length && (tag?.length || cipherText.length > 20));
}
