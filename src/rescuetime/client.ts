import { getDateInTimeZone } from "../wakatime/date";
import { normalizeRescueTimeComputerStats } from "./normalizers";
import type { Env, PublicRescueTimeComputerStats, RescueTimeFetch } from "./types";

const RESCUETIME_API_BASE_URL = "https://www.rescuetime.com/anapi";
export const DEFAULT_RESCUETIME_TIME_ZONE = "Europe/Paris";
export const DEFAULT_RESCUETIME_REVALIDATE_SECONDS = 300;

export class RescueTimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RescueTimeConfigError";
  }
}

export class RescueTimeFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RescueTimeFetchError";
  }
}

type FetchOptions = {
  env?: Env;
  fetchImpl?: RescueTimeFetch;
  now?: Date;
  timeZone?: string;
};

export function getRescueTimeComputerStatsDate({
  now = new Date(),
  timeZone = DEFAULT_RESCUETIME_TIME_ZONE,
}: Pick<FetchOptions, "now" | "timeZone"> = {}) {
  return getDateInTimeZone(now, timeZone);
}

export async function fetchRescueTimeComputerStats({
  env = process.env,
  fetchImpl = fetch,
  now = new Date(),
  timeZone = env.RESCUETIME_TIME_ZONE ?? DEFAULT_RESCUETIME_TIME_ZONE,
}: FetchOptions = {}): Promise<PublicRescueTimeComputerStats> {
  const apiKey = env.RESCUETIME_API_KEY;

  if (!apiKey) {
    throw new RescueTimeConfigError("Missing RESCUETIME_API_KEY");
  }

  const date = getRescueTimeComputerStatsDate({ now, timeZone });
  const url = new URL(`${RESCUETIME_API_BASE_URL}/data`);
  url.searchParams.set("perspective", "interval");
  url.searchParams.set("restrict_kind", "productivity");
  url.searchParams.set("resolution_time", "day");
  url.searchParams.set("restrict_begin", date);
  url.searchParams.set("restrict_end", date);
  url.searchParams.set("restrict_source_type", "computers");
  url.searchParams.set("format", "json");

  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    next: {
      revalidate: DEFAULT_RESCUETIME_REVALIDATE_SECONDS,
    },
  });

  if (!response.ok) {
    throw new RescueTimeFetchError("RescueTime computer stats request failed", response.status);
  }

  const payload = (await response.json()) as unknown;

  return normalizeRescueTimeComputerStats(payload, {
    date,
    fetchedAt: now.toISOString(),
  });
}
