import type { PublicRescueTimeComputerStats, RescueTimeTotal } from "./types";

const ZERO_TOTAL: RescueTimeTotal = {
  totalSeconds: 0,
  text: "0m",
};

type NormalizeOptions = {
  date: string;
  fetchedAt: string | null;
  unavailableReason?: string;
};

type SplitTotals = {
  productive: number;
  neutral: number;
  distracting: number;
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

function findHeaderIndex(headers: unknown[], pattern: RegExp): number {
  return headers.findIndex((header) => typeof header === "string" && pattern.test(header));
}

export function formatRescueTimeDuration(totalSeconds: number): string {
  const roundedMinutes = Math.round(Math.max(0, totalSeconds) / 60);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function makeTotal(totalSeconds: number): RescueTimeTotal {
  return {
    totalSeconds,
    text: formatRescueTimeDuration(totalSeconds),
  };
}

export function createEmptyRescueTimeComputerStats(
  options: NormalizeOptions,
): PublicRescueTimeComputerStats {
  return {
    date: options.date,
    total: ZERO_TOTAL,
    productive: ZERO_TOTAL,
    neutral: ZERO_TOTAL,
    distracting: ZERO_TOTAL,
    fetchedAt: options.fetchedAt,
    unavailableReason: options.unavailableReason,
  };
}

export function normalizeRescueTimeComputerStats(
  payload: unknown,
  options: NormalizeOptions,
): PublicRescueTimeComputerStats {
  const root = toRecord(payload);
  const headers = toArray(root?.row_headers);
  const rows = toArray(root?.rows);
  const secondsIndex = findHeaderIndex(headers, /time spent.*seconds/i);
  const productivityIndex = findHeaderIndex(headers, /productivity/i);

  if (secondsIndex === -1 || productivityIndex === -1) {
    return createEmptyRescueTimeComputerStats(options);
  }

  const totals: SplitTotals = {
    productive: 0,
    neutral: 0,
    distracting: 0,
  };

  for (const rawRow of rows) {
    if (!Array.isArray(rawRow)) {
      continue;
    }

    const seconds = toPositiveSeconds(rawRow[secondsIndex]);
    const productivity = toFiniteNumber(rawRow[productivityIndex]);

    if (seconds === 0 || productivity === null) {
      continue;
    }

    if (productivity > 0) {
      totals.productive += seconds;
    } else if (productivity < 0) {
      totals.distracting += seconds;
    } else {
      totals.neutral += seconds;
    }
  }

  const totalSeconds = totals.productive + totals.neutral + totals.distracting;

  return {
    date: options.date,
    total: makeTotal(totalSeconds),
    productive: makeTotal(totals.productive),
    neutral: makeTotal(totals.neutral),
    distracting: makeTotal(totals.distracting),
    fetchedAt: options.fetchedAt,
    unavailableReason: options.unavailableReason,
  };
}
