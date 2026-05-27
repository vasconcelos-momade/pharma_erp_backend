/** Converte BigInt e Decimal-like para JSON seguro em respostas HTTP. */
export function serializeForJson<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString() as T;
  }

  if (value instanceof Date) {
    return value.toISOString() as T;
  }

  if (typeof value === "object" && value !== null && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber() as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeForJson(item)) as T;
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = serializeForJson(entry);
    }
    return out as T;
  }

  return value;
}
