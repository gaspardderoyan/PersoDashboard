import { createGoogleHealthClient } from "./google-health-client";
import { normalizeActiveMinutes, normalizeSteps, normalizeTimeInBed } from "./normalizers";
import type { Env, GoogleHealthClient, HealthSnapshot } from "./types";

export type FetchHealthSnapshotOptions = {
  date: string;
  env: Env;
  now?: () => Date;
  healthClient?: GoogleHealthClient;
};

function addUnavailable(
  unavailable: Record<string, string>,
  key: string,
  reason: string | undefined,
) {
  if (reason) {
    unavailable[key] = reason;
  }
}

export async function fetchHealthSnapshot({
  date,
  env,
  now = () => new Date(),
  healthClient,
}: FetchHealthSnapshotOptions): Promise<HealthSnapshot> {
  const client = healthClient ?? createGoogleHealthClient(env);
  const accessToken = await client.getAccessToken();
  const [stepsResponse, activeMinutesResponse, sleepResponse] = await Promise.all([
    client.getDailyRollup("steps", date, accessToken),
    client.getDailyRollup("active-minutes", date, accessToken),
    client.getSleepData(date, accessToken),
  ]);

  const steps = normalizeSteps(stepsResponse);
  const activeMinutes = normalizeActiveMinutes(activeMinutesResponse);
  const timeInBed = normalizeTimeInBed(sleepResponse);
  const unavailable: Record<string, string> = {};

  addUnavailable(unavailable, "steps", steps.unavailableReason);
  addUnavailable(unavailable, "activeMinutes", activeMinutes.unavailableReason);
  addUnavailable(unavailable, "timeInBedMinutes", timeInBed.unavailableReason);

  return {
    date,
    steps: steps.value,
    timeInBedMinutes: timeInBed.value,
    activeMinutes: activeMinutes.value ?? { total: null, byLevel: {} },
    unavailable,
    fetchedAt: now().toISOString(),
  };
}
