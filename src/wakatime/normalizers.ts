import { getDateRange } from "./date";
import type {
  PublicWakaTimeCodingStats,
  WakaTimeBreakdownItem,
  WakaTimeDailyTotal,
  WakaTimeTotal,
} from "./types";

const ZERO_TOTAL: WakaTimeTotal = {
  totalSeconds: 0,
  text: "0m",
};

type NormalizeOptions = {
  startDate: string;
  endDate: string;
  fetchedAt: string | null;
  unavailableReason?: string;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toPositiveSeconds(value: unknown): number {
  const seconds = toFiniteNumber(value);
  return seconds === null || seconds < 0 ? 0 : seconds;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function formatCodingDuration(totalSeconds: number): string {
  const roundedMinutes = Math.round(Math.max(0, totalSeconds) / 60);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function makeTotal(totalSeconds: number, text?: string | null): WakaTimeTotal {
  return {
    totalSeconds,
    text: text ?? formatCodingDuration(totalSeconds),
  };
}

export function createEmptyWakaTimeCodingStats(
  options: NormalizeOptions,
): PublicWakaTimeCodingStats {
  return {
    todayTotal: ZERO_TOTAL,
    last7Total: ZERO_TOTAL,
    activeDayAverage: ZERO_TOTAL,
    dailyTotals: getDateRange(options.startDate, options.endDate).map((date) => ({
      date,
      ...ZERO_TOTAL,
    })),
    topLanguages: [],
    topEditors: [],
    fetchedAt: options.fetchedAt,
    unavailableReason: options.unavailableReason,
  };
}

function aggregateBreakdown(days: Record<string, unknown>[], key: "languages" | "editors") {
  const totals = new Map<string, { totalSeconds: number; color: string | null }>();

  for (const day of days) {
    for (const rawItem of toArray(day[key])) {
      const item = toRecord(rawItem);
      const name = toOptionalString(item?.name);
      const totalSeconds = toPositiveSeconds(item?.total_seconds);

      if (!name || totalSeconds === 0) {
        continue;
      }

      const existing = totals.get(name);
      totals.set(name, {
        totalSeconds: (existing?.totalSeconds ?? 0) + totalSeconds,
        color: existing?.color ?? toOptionalString(item?.color),
      });
    }
  }

  const grandTotal = [...totals.values()].reduce((total, item) => total + item.totalSeconds, 0);

  if (grandTotal === 0) {
    return [];
  }

  return [...totals.entries()]
    .map<WakaTimeBreakdownItem>(([name, item]) => ({
      name,
      totalSeconds: item.totalSeconds,
      text: formatCodingDuration(item.totalSeconds),
      percent: Math.round((item.totalSeconds / grandTotal) * 1000) / 10,
      color: item.color,
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds || a.name.localeCompare(b.name))
    .slice(0, 5);
}

export function normalizeWakaTimeSummaries(
  payload: unknown,
  options: NormalizeOptions,
): PublicWakaTimeCodingStats {
  const root = toRecord(payload);
  const rawDays = toArray(root?.data).flatMap((day) => {
    const record = toRecord(day);
    return record ? [record] : [];
  });
  const daysByDate = new Map<string, Record<string, unknown>>();

  for (const day of rawDays) {
    const range = toRecord(day.range);
    const date = toOptionalString(range?.date);

    if (date) {
      daysByDate.set(date, day);
    }
  }

  const dailyTotals: WakaTimeDailyTotal[] = getDateRange(options.startDate, options.endDate).map(
    (date) => {
      const day = daysByDate.get(date);
      const grandTotal = toRecord(day?.grand_total);
      const totalSeconds = toPositiveSeconds(grandTotal?.total_seconds);

      return {
        date,
        ...makeTotal(totalSeconds, toOptionalString(grandTotal?.text)),
      };
    },
  );

  const todayTotal = dailyTotals.at(-1) ?? { date: options.endDate, ...ZERO_TOTAL };
  const last7Seconds = dailyTotals
    .slice(-7)
    .reduce((total, day) => total + day.totalSeconds, 0);
  const activeDays = dailyTotals.filter((day) => day.totalSeconds > 0);
  const activeDayAverageSeconds =
    activeDays.length === 0
      ? 0
      : activeDays.reduce((total, day) => total + day.totalSeconds, 0) / activeDays.length;

  return {
    todayTotal: makeTotal(todayTotal.totalSeconds, todayTotal.text),
    last7Total: makeTotal(last7Seconds),
    activeDayAverage: makeTotal(activeDayAverageSeconds),
    dailyTotals,
    topLanguages: aggregateBreakdown(rawDays, "languages"),
    topEditors: aggregateBreakdown(rawDays, "editors"),
    fetchedAt: options.fetchedAt,
    unavailableReason: options.unavailableReason,
  };
}
