import type { ActiveMinutes } from "./types";

export const TRACKED_ACTIVE_MINUTE_LEVELS = ["moderate", "vigorous", "very_active"] as const;

export type TrackedActiveMinuteLevel = (typeof TRACKED_ACTIVE_MINUTE_LEVELS)[number];

export function toTrackedActiveMinuteLevel(level: string): TrackedActiveMinuteLevel | null {
  const key = level.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");

  if (key.endsWith("very_active")) {
    return "very_active";
  }

  if (key.endsWith("vigorous")) {
    return "vigorous";
  }

  if (key.endsWith("moderate")) {
    return "moderate";
  }

  return null;
}

export function summarizeTrackedActiveMinutes(
  levels: Record<string, number>,
): ActiveMinutes {
  const byLevel: Record<string, number> = {};

  for (const [rawLevel, minutes] of Object.entries(levels)) {
    const level = toTrackedActiveMinuteLevel(rawLevel);

    if (!level) {
      continue;
    }

    byLevel[level] = (byLevel[level] ?? 0) + minutes;
  }

  const total = TRACKED_ACTIVE_MINUTE_LEVELS.reduce(
    (sum, level) => sum + (byLevel[level] ?? 0),
    0,
  );

  return { total, byLevel };
}
