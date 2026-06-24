import { addDays, getDateInTimeZone } from "../wakatime/date";
import {
  createFortyTwoDailySnapshot,
  extractFortyTwoProfile,
  getFortyTwoCohortRank,
  normalizeFortyTwoDashboardStats,
} from "./normalizers";
import type { Env, FortyTwoDailySnapshot, FortyTwoFetch, PublicFortyTwoDashboardStats } from "./types";

const FORTY_TWO_API_BASE_URL = "https://api.intra.42.fr";
const FORTY_TWO_REQUEST_DELAY_MS = 600;
export const DEFAULT_FORTY_TWO_LOGIN = "gderoyan";
export const DEFAULT_FORTY_TWO_TIME_ZONE = "Europe/Paris";
export const DEFAULT_FORTY_TWO_LOGTIME_DAYS = 30;
export const DEFAULT_FORTY_TWO_REVALIDATE_SECONDS = 300;

export class FortyTwoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FortyTwoConfigError";
  }
}

export class FortyTwoFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FortyTwoFetchError";
  }
}

type FetchOptions = {
  env?: Env;
  fetchImpl?: FortyTwoFetch;
  now?: Date;
  days?: number;
  timeZone?: string;
  snapshots?: FortyTwoDailySnapshot[];
};

function waitForRateLimitWindow() {
  return new Promise((resolve) => {
    setTimeout(resolve, FORTY_TWO_REQUEST_DELAY_MS);
  });
}

export function getFortyTwoLogtimeRange({
  now = new Date(),
  days = DEFAULT_FORTY_TWO_LOGTIME_DAYS,
  timeZone = DEFAULT_FORTY_TWO_TIME_ZONE,
}: Pick<FetchOptions, "now" | "days" | "timeZone"> = {}) {
  const endDate = getDateInTimeZone(now, timeZone);

  return {
    startDate: addDays(endDate, -(days - 1)),
    endDate,
    timeZone,
  };
}

async function fetchFortyTwoToken({
  env,
  fetchImpl,
}: {
  env: Env;
  fetchImpl: FortyTwoFetch;
}): Promise<string> {
  const uid = env.FORTY_TWO_UID;
  const secret = env.FORTY_TWO_SECRET;

  if (!uid || !secret) {
    throw new FortyTwoConfigError("Missing FORTY_TWO_UID or FORTY_TWO_SECRET");
  }

  const response = await fetchImpl(new URL(`${FORTY_TWO_API_BASE_URL}/oauth/token`), {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: uid,
      client_secret: secret,
    }),
    headers: {
      Accept: "application/json",
    },
    next: {
      revalidate: DEFAULT_FORTY_TWO_REVALIDATE_SECONDS,
    },
  });

  if (!response.ok) {
    throw new FortyTwoFetchError("42 token request failed", response.status);
  }

  const payload = (await response.json()) as unknown;
  const token =
    typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload) &&
    typeof (payload as Record<string, unknown>).access_token === "string"
      ? ((payload as Record<string, unknown>).access_token as string)
      : null;

  if (!token) {
    throw new FortyTwoFetchError("42 token response missing access token", response.status);
  }

  return token;
}

async function fetchFortyTwoJson({
  token,
  path,
  params = {},
  fetchImpl,
}: {
  token: string;
  path: string;
  params?: Record<string, string | number | null | undefined>;
  fetchImpl: FortyTwoFetch;
}): Promise<{ payload: unknown; total: number | null }> {
  const url = new URL(`${FORTY_TWO_API_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    next: {
      revalidate: DEFAULT_FORTY_TWO_REVALIDATE_SECONDS,
    },
  });

  if (!response.ok) {
    throw new FortyTwoFetchError(`42 request failed for ${path}`, response.status);
  }

  return {
    payload: await response.json(),
    total: Number(response.headers.get("x-total")) || null,
  };
}

export async function fetchFortyTwoLiveStats({
  env = process.env,
  fetchImpl = fetch,
  now = new Date(),
  days = DEFAULT_FORTY_TWO_LOGTIME_DAYS,
  timeZone = env.FORTY_TWO_TIME_ZONE ?? DEFAULT_FORTY_TWO_TIME_ZONE,
  snapshots = [],
}: FetchOptions = {}): Promise<{
  stats: PublicFortyTwoDashboardStats;
  snapshot: FortyTwoDailySnapshot;
}> {
  const login = env.FORTY_TWO_LOGIN ?? DEFAULT_FORTY_TWO_LOGIN;
  const token = await fetchFortyTwoToken({ env, fetchImpl });
  const range = getFortyTwoLogtimeRange({ now, days, timeZone });
  const fetchedAt = now.toISOString();
  await waitForRateLimitWindow();
  const { payload: userPayload } = await fetchFortyTwoJson({
    token,
    path: `/v2/users/${encodeURIComponent(login)}`,
    fetchImpl,
  });
  const profile = extractFortyTwoProfile(userPayload, login);
  await waitForRateLimitWindow();
  const { payload: locationStatsPayload } = await fetchFortyTwoJson({
    token,
    path: `/v2/users/${encodeURIComponent(login)}/locations_stats`,
    params: {
      begin_at: range.startDate,
      end_at: range.endDate,
      time_zone: range.timeZone,
    },
    fetchImpl,
  });
  let rankAboveCount: number | null = null;
  let rankPopulation: number | null = null;

  if (
    profile.cursusId !== null &&
    profile.campusId !== null &&
    profile.level !== null &&
    profile.cohortStartDate !== null &&
    profile.cohortEndDate !== null
  ) {
    const rankBaseParams = {
      "filter[active]": "true",
      "filter[campus_id]": profile.campusId,
      "range[begin_at]": `${profile.cohortStartDate},${profile.cohortEndDate}`,
      "page[size]": 1,
    } as const;
    await waitForRateLimitWindow();
    const populationResult = await fetchFortyTwoJson({
      token,
      path: `/v2/cursus/${profile.cursusId}/cursus_users`,
      params: rankBaseParams,
      fetchImpl,
    });
    await waitForRateLimitWindow();
    const aboveResult = await fetchFortyTwoJson({
      token,
      path: `/v2/cursus/${profile.cursusId}/cursus_users`,
      params: {
        ...rankBaseParams,
        "range[level]": `${(profile.level + 0.000001).toFixed(6)},99`,
      },
      fetchImpl,
    });

    rankPopulation = populationResult.total;
    rankAboveCount = aboveResult.total;
  }

  const stats = normalizeFortyTwoDashboardStats({
    login,
    startDate: range.startDate,
    endDate: range.endDate,
    fetchedAt,
    locationStatsPayload,
    userPayload,
    rankAboveCount,
    rankPopulation,
    snapshots,
  });
  const snapshot = createFortyTwoDailySnapshot({
    date: range.endDate,
    todayLogtimeMinutes: stats.todayLogtime.totalMinutes,
    profile,
    cohortRank: getFortyTwoCohortRank({
      rankAboveCount,
      rankPopulation,
      cohortLabel: profile.cohortLabel,
    }),
    fetchedAt,
  });

  return {
    stats,
    snapshot,
  };
}
