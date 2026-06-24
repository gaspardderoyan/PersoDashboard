import { neon } from "@neondatabase/serverless";
import type { Env, HealthDailyRecord, HealthSnapshot, HealthStore } from "./types";
import { summarizeTrackedActiveMinutes } from "./active-minutes";

type Sql = ReturnType<typeof neon>;

type HealthDailyRow = {
  date: string | Date;
  steps: number | null;
  time_in_bed_minutes: number | null;
  active_minutes_total: number | null;
  active_minutes_by_level: unknown;
  unavailable: unknown;
  fetched_at: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
};

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

export function getDatabaseUrl(env: Env): string {
  const databaseUrl = env.DATABASE_URL ?? env.POSTGRES_URL ?? env.POSTGRES_URL_NON_POOLING;

  if (!databaseUrl) {
    throw new DatabaseConfigError("Missing DATABASE_URL");
  }

  return databaseUrl;
}

function toIsoDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function toIsoDateTime(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

function toJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return toJsonObject(parsed);
    } catch {
      return {};
    }
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function toNumberRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(toJsonObject(value)).flatMap(([key, minutes]) => {
      return typeof minutes === "number" && Number.isFinite(minutes) ? [[key, minutes]] : [];
    }),
  );
}

function rowToHealthDailyRecord(row: HealthDailyRow): HealthDailyRecord {
  const activeMinutesByLevel = toNumberRecord(row.active_minutes_by_level);
  const activeMinutes =
    row.active_minutes_total === null && Object.keys(activeMinutesByLevel).length === 0
      ? { total: null, byLevel: {} }
      : summarizeTrackedActiveMinutes(activeMinutesByLevel);

  return {
    date: toIsoDate(row.date),
    steps: row.steps,
    timeInBedMinutes: row.time_in_bed_minutes,
    activeMinutes,
    unavailable: toJsonObject(row.unavailable) as Record<string, string>,
    fetchedAt: toIsoDateTime(row.fetched_at),
    storedAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  };
}

export function createHealthStore(env: Env = process.env): HealthStore {
  return createHealthStoreFromSql(neon(getDatabaseUrl(env)));
}

export function createHealthStoreFromSql(sql: Sql): HealthStore {
  return {
    async ensureSchema() {
      await sql`
        CREATE TABLE IF NOT EXISTS health_daily (
          date date PRIMARY KEY,
          steps integer,
          time_in_bed_minutes integer,
          active_minutes_total integer,
          active_minutes_by_level jsonb NOT NULL DEFAULT '{}'::jsonb,
          unavailable jsonb NOT NULL DEFAULT '{}'::jsonb,
          fetched_at timestamptz NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT health_daily_steps_nonnegative CHECK (steps IS NULL OR steps >= 0),
          CONSTRAINT health_daily_time_in_bed_nonnegative CHECK (
            time_in_bed_minutes IS NULL OR time_in_bed_minutes >= 0
          ),
          CONSTRAINT health_daily_active_minutes_nonnegative CHECK (
            active_minutes_total IS NULL OR active_minutes_total >= 0
          )
        )
      `;
    },

    async upsertDailySnapshot(snapshot: HealthSnapshot) {
      const [row] = (await sql`
        INSERT INTO health_daily (
          date,
          steps,
          time_in_bed_minutes,
          active_minutes_total,
          active_minutes_by_level,
          unavailable,
          fetched_at,
          updated_at
        )
        VALUES (
          ${snapshot.date}::date,
          ${snapshot.steps},
          ${snapshot.timeInBedMinutes},
          ${snapshot.activeMinutes.total},
          ${JSON.stringify(snapshot.activeMinutes.byLevel)}::jsonb,
          ${JSON.stringify(snapshot.unavailable)}::jsonb,
          ${snapshot.fetchedAt}::timestamptz,
          now()
        )
        ON CONFLICT (date) DO UPDATE SET
          steps = EXCLUDED.steps,
          time_in_bed_minutes = EXCLUDED.time_in_bed_minutes,
          active_minutes_total = EXCLUDED.active_minutes_total,
          active_minutes_by_level = EXCLUDED.active_minutes_by_level,
          unavailable = EXCLUDED.unavailable,
          fetched_at = EXCLUDED.fetched_at,
          updated_at = now()
        RETURNING *
      `) as HealthDailyRow[];

      return rowToHealthDailyRecord(row);
    },

    async listDailySnapshots(limit: number) {
      const rows = (await sql`
        SELECT *
        FROM health_daily
        ORDER BY date DESC
        LIMIT ${limit}
      `) as HealthDailyRow[];

      return rows.map(rowToHealthDailyRecord);
    },
  };
}
