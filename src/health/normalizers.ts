import type { ActiveMinutes, NormalizedValue } from "./types";
import { summarizeTrackedActiveMinutes, toTrackedActiveMinuteLevel } from "./active-minutes";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseInt64(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function getRollupPoints(response: unknown): Record<string, unknown>[] {
  const body = asRecord(response);
  const rollupDataPoints = body?.rollupDataPoints;

  if (!Array.isArray(rollupDataPoints)) {
    return [];
  }

  return rollupDataPoints.flatMap((point) => {
    const record = asRecord(point);
    return record ? [record] : [];
  });
}

export function normalizeSteps(response: unknown): NormalizedValue<number> {
  const points = getRollupPoints(response);
  let total = 0;
  let found = false;

  for (const point of points) {
    const steps = asRecord(point.steps);
    if (!steps) {
      continue;
    }

    const count = parseInt64(steps.countSum);
    if (count === null) {
      return { value: null, unavailableReason: "invalid_steps_data" };
    }

    total += count;
    found = true;
  }

  if (!found) {
    return { value: null, unavailableReason: "no_steps_data" };
  }

  return { value: total };
}

export function normalizeActiveMinutes(response: unknown): NormalizedValue<ActiveMinutes> {
  const points = getRollupPoints(response);
  const byLevel: Record<string, number> = {};
  let found = false;

  for (const point of points) {
    const activeMinutes = asRecord(point.activeMinutes);
    if (!activeMinutes) {
      continue;
    }

    found = true;
    const rollups = activeMinutes.activeMinutesRollupByActivityLevel;

    if (!Array.isArray(rollups)) {
      continue;
    }

    for (const rollup of rollups) {
      const record = asRecord(rollup);
      if (!record) {
        return { value: null, unavailableReason: "invalid_active_minutes_data" };
      }

      const rawLevel = typeof record.activityLevel === "string" ? record.activityLevel : "UNKNOWN";
      const key = toTrackedActiveMinuteLevel(rawLevel);

      if (!key) {
        continue;
      }

      const minutes = parseInt64(record.activeMinutesSum);
      if (minutes === null) {
        return { value: null, unavailableReason: "invalid_active_minutes_data" };
      }

      byLevel[key] = (byLevel[key] ?? 0) + minutes;
    }
  }

  if (!found) {
    return { value: null, unavailableReason: "no_active_minutes_data" };
  }

  return { value: summarizeTrackedActiveMinutes(byLevel) };
}

export function normalizeTimeInBed(response: unknown): NormalizedValue<number> {
  const body = asRecord(response);
  const dataPoints = body?.dataPoints;

  if (!Array.isArray(dataPoints)) {
    return { value: null, unavailableReason: "no_sleep_data" };
  }

  const candidates = dataPoints.flatMap((point) => {
    const record = asRecord(point);
    const sleep = asRecord(record?.sleep);
    const summary = asRecord(sleep?.summary);
    const metadata = asRecord(sleep?.metadata);
    const minutes = parseInt64(summary?.minutesInSleepPeriod);

    if (minutes === null) {
      return [];
    }

    return [
      {
        minutes,
        isMain: metadata?.main === true,
        isNap: metadata?.nap === true,
      },
    ];
  });

  if (candidates.length === 0) {
    return { value: null, unavailableReason: "no_sleep_data" };
  }

  const mainSleep = candidates
    .filter((candidate) => candidate.isMain && !candidate.isNap)
    .sort((a, b) => b.minutes - a.minutes)[0];

  const fallbackSleep = candidates
    .filter((candidate) => !candidate.isNap)
    .sort((a, b) => b.minutes - a.minutes)[0];

  return { value: (mainSleep ?? fallbackSleep ?? candidates[0]).minutes };
}
