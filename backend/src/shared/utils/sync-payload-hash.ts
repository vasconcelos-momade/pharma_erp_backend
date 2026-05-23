import { createHash } from "crypto";

export function hashSyncPayload(payload: unknown): string {
  const normalized =
    payload === undefined || payload === null
      ? ""
      : JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash("sha256").update(normalized).digest("hex");
}
