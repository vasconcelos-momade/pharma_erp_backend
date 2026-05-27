import { createHash } from "crypto";

const MAX_FAILED_ATTEMPTS = Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS ?? 5);
const LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES ?? 15);

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getLockDurationMs(): number {
  return LOCK_MINUTES * 60 * 1000;
}

export function isAccountLocked(lockedUntil: Date | null | undefined): boolean {
  if (!lockedUntil) return false;
  return lockedUntil.getTime() > Date.now();
}

export function shouldLockAccount(failedLoginCount: number): boolean {
  return failedLoginCount >= MAX_FAILED_ATTEMPTS;
}

export function nextLockUntil(): Date {
  return new Date(Date.now() + getLockDurationMs());
}

export function resetAfterSuccess() {
  return {
    failedLoginCount: 0,
    lockedUntil: null as Date | null,
  };
}

export function incrementAfterFailure(currentCount: number) {
  const failedLoginCount = currentCount + 1;
  const lockedUntil = shouldLockAccount(failedLoginCount)
    ? nextLockUntil()
    : null;
  return { failedLoginCount, lockedUntil };
}
