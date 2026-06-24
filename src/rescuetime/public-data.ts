import {
  DEFAULT_RESCUETIME_TIME_ZONE,
  fetchRescueTimeComputerStats,
  getRescueTimeComputerStatsDate,
} from "./client";
import { createEmptyRescueTimeComputerStats } from "./normalizers";
import type { Env, PublicRescueTimeComputerStats, RescueTimeFetch } from "./types";

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedStats:
  | {
      expiresAt: number;
      value: PublicRescueTimeComputerStats;
    }
  | null = null;

type PublicDataOptions = {
  env?: Env;
  fetchImpl?: RescueTimeFetch;
  now?: Date;
  cacheTtlMs?: number;
};

export function clearRescueTimeComputerStatsCache() {
  cachedStats = null;
}

function makeUnavailableStats(
  now: Date,
  unavailableReason: string,
  env: Env,
): PublicRescueTimeComputerStats {
  const date = getRescueTimeComputerStatsDate({
    now,
    timeZone: env.RESCUETIME_TIME_ZONE ?? DEFAULT_RESCUETIME_TIME_ZONE,
  });

  return createEmptyRescueTimeComputerStats({
    date,
    fetchedAt: null,
    unavailableReason,
  });
}

export async function getPublicRescueTimeComputerStats({
  env = process.env,
  fetchImpl,
  now = new Date(),
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
}: PublicDataOptions = {}): Promise<PublicRescueTimeComputerStats> {
  const nowMs = now.getTime();

  if (cacheTtlMs > 0 && cachedStats && cachedStats.expiresAt > nowMs) {
    return cachedStats.value;
  }

  try {
    const value = await fetchRescueTimeComputerStats({
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
      env.RESCUETIME_API_KEY ? "fetch_failed" : "missing_api_key",
      env,
    );
  }
}
