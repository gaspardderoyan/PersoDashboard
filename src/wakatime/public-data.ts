import {
  DEFAULT_WAKATIME_SUMMARY_DAYS,
  DEFAULT_WAKATIME_TIME_ZONE,
  fetchWakaTimeCodingStats,
  getWakaTimeSummaryRange,
} from "./client";
import { createEmptyWakaTimeCodingStats } from "./normalizers";
import type { Env, PublicWakaTimeCodingStats, WakaTimeFetch } from "./types";

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedStats:
  | {
      expiresAt: number;
      value: PublicWakaTimeCodingStats;
    }
  | null = null;

type PublicDataOptions = {
  env?: Env;
  fetchImpl?: WakaTimeFetch;
  now?: Date;
  cacheTtlMs?: number;
};

export function clearWakaTimeCodingStatsCache() {
  cachedStats = null;
}

function makeUnavailableStats(
  now: Date,
  unavailableReason: string,
  env: Env,
): PublicWakaTimeCodingStats {
  const range = getWakaTimeSummaryRange({
    now,
    days: DEFAULT_WAKATIME_SUMMARY_DAYS,
    timeZone: env.WAKATIME_TIME_ZONE ?? DEFAULT_WAKATIME_TIME_ZONE,
  });

  return createEmptyWakaTimeCodingStats({
    startDate: range.startDate,
    endDate: range.endDate,
    fetchedAt: null,
    unavailableReason,
  });
}

export async function getPublicWakaTimeCodingStats({
  env = process.env,
  fetchImpl,
  now = new Date(),
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
}: PublicDataOptions = {}): Promise<PublicWakaTimeCodingStats> {
  const nowMs = now.getTime();

  if (cacheTtlMs > 0 && cachedStats && cachedStats.expiresAt > nowMs) {
    return cachedStats.value;
  }

  try {
    const value = await fetchWakaTimeCodingStats({
      env,
      fetchImpl,
      now,
    });

    if (cacheTtlMs > 0) {
      cachedStats = {
        expiresAt: nowMs + cacheTtlMs,
        value,
      };
    }

    return value;
  } catch {
    return makeUnavailableStats(
      now,
      env.WAKATIME_API_KEY ? "fetch_failed" : "missing_api_key",
      env,
    );
  }
}
