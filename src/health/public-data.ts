import { createHealthStore } from "./store";
import type { Env, HealthDailyRecord } from "./types";

export async function getRecentHealthDailyRecords(
  env: Env = process.env,
  limit = 28,
): Promise<HealthDailyRecord[]> {
  try {
    return await createHealthStore(env).listDailySnapshots(limit);
  } catch {
    return [];
  }
}
