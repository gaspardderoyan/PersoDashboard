export type Env = Record<string, string | undefined>;

export type ActiveMinutes = {
  total: number | null;
  byLevel: Record<string, number>;
};

export type HealthSnapshot = {
  date: string;
  steps: number | null;
  timeInBedMinutes: number | null;
  activeMinutes: ActiveMinutes;
  unavailable: Record<string, string>;
  fetchedAt: string;
};

export type HealthProofPayload = HealthSnapshot;

export type HealthDailyRecord = HealthSnapshot & {
  storedAt: string;
  updatedAt: string;
};

export type HealthStore = {
  ensureSchema(): Promise<void>;
  upsertDailySnapshot(snapshot: HealthSnapshot): Promise<HealthDailyRecord>;
  listDailySnapshots(limit: number): Promise<HealthDailyRecord[]>;
};

export type GoogleHealthDataType = "steps" | "active-minutes";

export type GoogleHealthClient = {
  getAccessToken(): Promise<string>;
  getDailyRollup(dataType: GoogleHealthDataType, date: string, accessToken: string): Promise<unknown>;
  getSleepData(date: string, accessToken: string): Promise<unknown>;
};

export type NormalizedValue<T> = {
  value: T | null;
  unavailableReason?: string;
};
