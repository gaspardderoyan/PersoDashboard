import { addDays, getDateInTimeZone } from "./date";
import { normalizeWakaTimeSummaries } from "./normalizers";
import type { Env, PublicWakaTimeCodingStats, WakaTimeFetch } from "./types";

const WAKATIME_API_BASE_URL = "https://wakatime.com/api/v1";
export const DEFAULT_WAKATIME_TIME_ZONE = "Europe/Paris";
export const DEFAULT_WAKATIME_SUMMARY_DAYS = 30;
export const DEFAULT_WAKATIME_REVALIDATE_SECONDS = 300;

export class WakaTimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WakaTimeConfigError";
  }
}

export class WakaTimeFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WakaTimeFetchError";
  }
}

type FetchOptions = {
  env?: Env;
  fetchImpl?: WakaTimeFetch;
  now?: Date;
  days?: number;
  timeZone?: string;
};

export function getWakaTimeSummaryRange({
  now = new Date(),
  days = DEFAULT_WAKATIME_SUMMARY_DAYS,
  timeZone = DEFAULT_WAKATIME_TIME_ZONE,
}: Pick<FetchOptions, "now" | "days" | "timeZone"> = {}) {
  const endDate = getDateInTimeZone(now, timeZone);

  return {
    startDate: addDays(endDate, -(days - 1)),
    endDate,
    timeZone,
  };
}

export async function fetchWakaTimeCodingStats({
  env = process.env,
  fetchImpl = fetch,
  now = new Date(),
  days = DEFAULT_WAKATIME_SUMMARY_DAYS,
  timeZone = env.WAKATIME_TIME_ZONE ?? DEFAULT_WAKATIME_TIME_ZONE,
}: FetchOptions = {}): Promise<PublicWakaTimeCodingStats> {
  const apiKey = env.WAKATIME_API_KEY;

  if (!apiKey) {
    throw new WakaTimeConfigError("Missing WAKATIME_API_KEY");
  }

  const range = getWakaTimeSummaryRange({ now, days, timeZone });
  const url = new URL(`${WAKATIME_API_BASE_URL}/users/current/summaries`);
  url.searchParams.set("start", range.startDate);
  url.searchParams.set("end", range.endDate);
  url.searchParams.set("timezone", range.timeZone);

  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(apiKey).toString("base64")}`,
      Accept: "application/json",
    },
    next: {
      revalidate: DEFAULT_WAKATIME_REVALIDATE_SECONDS,
    },
  });

  if (!response.ok || response.status === 202) {
    throw new WakaTimeFetchError("WakaTime summaries request failed", response.status);
  }

  const payload = (await response.json()) as unknown;

  return normalizeWakaTimeSummaries(payload, {
    startDate: range.startDate,
    endDate: range.endDate,
    fetchedAt: now.toISOString(),
  });
}
