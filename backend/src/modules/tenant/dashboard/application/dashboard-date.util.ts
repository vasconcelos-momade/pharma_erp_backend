export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function daysAgo(days: number, from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return startOfDay(d);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(value) || 0;
}

export const FATURA_VENDA_WHERE = {
  deletedAt: null,
  estado: { in: ["EMITIDA", "PAGA", "PARCIAL"] },
} as const;
