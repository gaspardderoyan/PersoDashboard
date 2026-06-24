import { neon } from "@neondatabase/serverless";
import type { Env, FortyTwoDailySnapshot } from "./types";
import { normalizeFortyTwoSnapshots } from "./normalizers";

type Sql = ReturnType<typeof neon>;

type FortyTwoDailyRow = {
  date: string | Date;
  logtime_minutes: number;
  level: number | string | null;
  cohort_rank: number | null;
  cohort_population: number | null;
  cohort_label: string | null;
  fetched_at: string | Date;
};

export type FortyTwoStore = {
  ensureSchema(): Promise<void>;
  upsertDailySnapshot(snapshot: FortyTwoDailySnapshot): Promise<FortyTwoDailySnapshot>;
  listDailySnapshots(limit: number): Promise<FortyTwoDailySnapshot[]>;
};

export class FortyTwoDatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FortyTwoDatabaseConfigError";
  }
}

function getDatabaseUrl(env: Env): string {
  const databaseUrl = env.DATABASE_URL ?? env.POSTGRES_URL ?? env.POSTGRES_URL_NON_POOLING;

  if (!databaseUrl) {
    throw new FortyTwoDatabaseConfigError("Missing DATABASE_URL");
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

function rowToFortyTwoDailySnapshot(row: FortyTwoDailyRow): FortyTwoDailySnapshot {
  const level = typeof row.level === "string" ? Number(row.level) : row.level;

  return {
    date: toIsoDate(row.date),
    logtimeMinutes: row.logtime_minutes,
    level: typeof level === "number" && Number.isFinite(level) ? level : null,
    rank: row.cohort_rank,
    cohortPopulation: row.cohort_population,
    cohortLabel: row.cohort_label,
    fetchedAt: toIsoDateTime(row.fetched_at),
  };
}

export function createFortyTwoStore(env: Env = process.env): FortyTwoStore {
  return createFortyTwoStoreFromSql(neon(getDatabaseUrl(env)));
}

export function createFortyTwoStoreFromSql(sql: Sql): FortyTwoStore {
  return {
    async ensureSchema() {
      await sql`
        CREATE TABLE IF NOT EXISTS forty_two_daily (
          date date PRIMARY KEY,
          logtime_minutes integer NOT NULL DEFAULT 0,
          level numeric(8, 2),
          cohort_rank integer,
          cohort_population integer,
          cohort_label text,
          fetched_at timestamptz NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT forty_two_daily_logtime_nonnegative CHECK (logtime_minutes >= 0),
          CONSTRAINT forty_two_daily_level_nonnegative CHECK (level IS NULL OR level >= 0),
          CONSTRAINT forty_two_daily_rank_positive CHECK (cohort_rank IS NULL OR cohort_rank >= 1),
          CONSTRAINT forty_two_daily_population_positive CHECK (
            cohort_population IS NULL OR cohort_population >= 1
          )
        )
      `;
    },

    async upsertDailySnapshot(snapshot: FortyTwoDailySnapshot) {
      const [row] = (await sql`
        INSERT INTO forty_two_daily (
          date,
          logtime_minutes,
          level,
          cohort_rank,
          cohort_population,
          cohort_label,
          fetched_at,
          updated_at
        )
        VALUES (
          ${snapshot.date}::date,
          ${snapshot.logtimeMinutes},
          ${snapshot.level},
          ${snapshot.rank},
          ${snapshot.cohortPopulation},
          ${snapshot.cohortLabel},
          ${snapshot.fetchedAt}::timestamptz,
          now()
        )
        ON CONFLICT (date) DO UPDATE SET
          logtime_minutes = EXCLUDED.logtime_minutes,
          level = EXCLUDED.level,
          cohort_rank = EXCLUDED.cohort_rank,
          cohort_population = EXCLUDED.cohort_population,
          cohort_label = EXCLUDED.cohort_label,
          fetched_at = EXCLUDED.fetched_at,
          updated_at = now()
        RETURNING *
      `) as FortyTwoDailyRow[];

      return rowToFortyTwoDailySnapshot(row);
    },

    async listDailySnapshots(limit: number) {
      const rows = (await sql`
        SELECT
          date,
          logtime_minutes,
          level,
          cohort_rank,
          cohort_population,
          cohort_label,
          fetched_at
        FROM forty_two_daily
        ORDER BY date DESC
        LIMIT ${limit}
      `) as FortyTwoDailyRow[];

      return normalizeFortyTwoSnapshots(rows.map(rowToFortyTwoDailySnapshot));
    },
  };
}

