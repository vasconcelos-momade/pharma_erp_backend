export function normalizePage(page?: number, pageSize?: number) {
  const safePage = Math.max(1, page ?? 1);
  const safePageSize = Math.min(100, Math.max(1, pageSize ?? 20));
  return { page: safePage, pageSize: safePageSize };
}

export function parseDateRange(from?: string, to?: string) {
  const start = from ? new Date(from) : undefined;
  const end = to ? new Date(to) : undefined;

  if (start && !Number.isNaN(start.getTime())) {
    start.setHours(0, 0, 0, 0);
  }
  if (end && !Number.isNaN(end.getTime())) {
    end.setHours(23, 59, 59, 999);
  }

  return {
    from:
      start && !Number.isNaN(start.getTime())
        ? start
        : undefined,
    to:
      end && !Number.isNaN(end.getTime())
        ? end
        : undefined,
  };
}

export function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && "toString" in (value as Record<string, unknown>)) {
    return Number(String(value));
  }
  return 0;
}

export function isReceitaExpired(dataReceita: Date, now = new Date()) {
  const expiry = new Date(dataReceita);
  expiry.setDate(expiry.getDate() + 30);
  return expiry < now;
}

export function inferReceitaStatus(item: {
  dataReceita: Date;
  dispensacoesCount?: number;
  livroSaidasCount?: number;
}, now = new Date()) {
  const used = (item.dispensacoesCount ?? 0) > 0 || (item.livroSaidasCount ?? 0) > 0;
  if (used) return "UTILIZADA";
  if (isReceitaExpired(item.dataReceita, now)) return "EXPIRADA";
  return "PENDENTE";
}

export function inferReceitaOrigem(origens: string[]) {
  if (origens.includes("DIGITAL")) return "DIGITAL";
  if (origens.includes("SISTEMA_INTERNO")) return "SISTEMA_INTERNO";
  return "FISICA";
}

export function safeContains(search?: string) {
  const value = search?.trim();
  return value ? { contains: value } : undefined;
}
