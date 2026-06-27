import {
  daysAgo,
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
} from "./dashboard-date.util";

export const DASHBOARD_PERIOD_PRESETS = [
  "today",
  "yesterday",
  "last7days",
  "last30days",
  "thisMonth",
  "lastMonth",
  "thisYear",
  "custom",
] as const;

export type DashboardPeriodPreset = (typeof DASHBOARD_PERIOD_PRESETS)[number];

export type DashboardPeriodParams = {
  days?: number;
  period?: string;
  from?: string;
  to?: string;
};

export type ResolvedDashboardPeriod = {
  from: Date;
  to: Date;
  days: number;
  period: DashboardPeriodPreset | "days";
};

function diffDaysInclusive(from: Date, to: Date): number {
  const ms = endOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.max(1, Math.min(366, Math.ceil(ms / 86_400_000) + 1));
}

export function resolveDashboardPeriod(
  params: DashboardPeriodParams = {},
  now = new Date(),
): ResolvedDashboardPeriod {
  const todayEnd = endOfDay(now);

  if (params.from && params.to) {
    const from = startOfDay(new Date(params.from));
    const to = endOfDay(new Date(params.to));
    return {
      from,
      to,
      days: diffDaysInclusive(from, to),
      period: "custom",
    };
  }

  switch (params.period) {
    case "today":
      return {
        from: startOfDay(now),
        to: todayEnd,
        days: 1,
        period: "today",
      };
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        from: startOfDay(yesterday),
        to: endOfDay(yesterday),
        days: 1,
        period: "yesterday",
      };
    }
    case "last7days":
      return {
        from: daysAgo(6, now),
        to: todayEnd,
        days: 7,
        period: "last7days",
      };
    case "last30days":
      return {
        from: daysAgo(29, now),
        to: todayEnd,
        days: 30,
        period: "last30days",
      };
    case "thisMonth":
      return {
        from: startOfMonth(now),
        to: todayEnd,
        days: diffDaysInclusive(startOfMonth(now), todayEnd),
        period: "thisMonth",
      };
    case "lastMonth": {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const from = startOfMonth(lastMonth);
      const to = endOfMonth(lastMonth);
      return {
        from,
        to,
        days: diffDaysInclusive(from, to),
        period: "lastMonth",
      };
    }
    case "thisYear": {
      const from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return {
        from,
        to: todayEnd,
        days: diffDaysInclusive(from, todayEnd),
        period: "thisYear",
      };
    }
    default: {
      const days = Math.min(90, Math.max(7, params.days ?? 30));
      return {
        from: daysAgo(days - 1, now),
        to: todayEnd,
        days,
        period: "days",
      };
    }
  }
}

export function serializePeriodo(period: ResolvedDashboardPeriod) {
  return {
    days: period.days,
    period: period.period,
    from: period.from.toISOString(),
    to: period.to.toISOString(),
  };
}
