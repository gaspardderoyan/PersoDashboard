import {
  DEFAULT_FORTY_TWO_LOGTIME_DAYS,
  DEFAULT_FORTY_TWO_LOGIN,
  DEFAULT_FORTY_TWO_TIME_ZONE,
  fetchFortyTwoLiveStats,
  getFortyTwoLogtimeRange,
} from "./client";
import {
  createEmptyFortyTwoDashboardStats,
  getFortyTwoLevelProgression,
  getFortyTwoRankProgression,
} from "./normalizers";
import { createFortyTwoStore } from "./store";
import type { Env, FortyTwoDailySnapshot, FortyTwoFetch, PublicFortyTwoDashboardStats } from "./types";

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_SNAPSHOT_LIMIT = 180;

let cachedStats:
  | {
      expiresAt: number;
      value: PublicFortyTwoDashboardStats;
    }
  | null = null;

type PublicDataOptions = {
  env?: Env;
  fetchImpl?: FortyTwoFetch;
  now?: Date;
  cacheTtlMs?: number;
};

export function clearFortyTwoDashboardStatsCache() {
  cachedStats = null;
}

function makeUnavailableStats(
  now: Date,
  unavailableReason: string,
  env: Env,
): PublicFortyTwoDashboardStats {
  const range = getFortyTwoLogtimeRange({
    now,
    days: DEFAULT_FORTY_TWO_LOGTIME_DAYS,
    timeZone: env.FORTY_TWO_TIME_ZONE ?? DEFAULT_FORTY_TWO_TIME_ZONE,
  });

  return createEmptyFortyTwoDashboardStats({
    login: env.FORTY_TWO_LOGIN ?? DEFAULT_FORTY_TWO_LOGIN,
    startDate: range.startDate,
    endDate: range.endDate,
    fetchedAt: null,
    unavailableReason,
  });
}

async function persistAndListSnapshots(
  snapshot: FortyTwoDailySnapshot,
  env: Env,
): Promise<FortyTwoDailySnapshot[]> {
  const store = createFortyTwoStore(env);

  await store.ensureSchema();
  await store.upsertDailySnapshot(snapshot);
  return store.listDailySnapshots(DEFAULT_SNAPSHOT_LIMIT);
}

export async function getPublicFortyTwoDashboardStats({
  env = process.env,
  fetchImpl,
  now = new Date(),
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
}: PublicDataOptions = {}): Promise<PublicFortyTwoDashboardStats> {
  const nowMs = now.getTime();

  if (cacheTtlMs > 0 && cachedStats && cachedStats.expiresAt > nowMs) {
    return cachedStats.value;
  }

  try {
    const { stats, snapshot } = await fetchFortyTwoLiveStats({
      env,
      fetchImpl,
      now,
    });
    let snapshots = [snapshot];

    try {
      snapshots = await persistAndListSnapshots(snapshot, env);
    } catch {
      snapshots = [snapshot];
    }

    const value: PublicFortyTwoDashboardStats = {
      ...stats,
      levelProgression: getFortyTwoLevelProgression(snapshots),
      rankProgression: getFortyTwoRankProgression(snapshots),
    };

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
      env.FORTY_TWO_UID && env.FORTY_TWO_SECRET ? "fetch_failed" : "missing_credentials",
      env,
    );
  }
}
