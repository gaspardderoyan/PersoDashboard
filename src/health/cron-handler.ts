import { currentDateForTimeZone, defaultDateForTimeZone, isIsoDate } from "./date";
import { fetchHealthSnapshot } from "./collect";
import { DatabaseConfigError, createHealthStore } from "./store";
import { requireBearerToken } from "./auth";
import { GoogleHealthFetchError } from "./google-health-client";
import type { Env, GoogleHealthClient, HealthStore } from "./types";

type HealthCronRequestDeps = {
  env: Env;
  now?: () => Date;
  healthClient?: GoogleHealthClient;
  store?: HealthStore;
};

function getRequestedDates(request: Request, env: Env, now: () => Date): string[] {
  const url = new URL(request.url);
  const requestedDate = url.searchParams.get("date");

  if (requestedDate) {
    return [requestedDate];
  }

  const timeZone = env.GOOGLE_HEALTH_TIME_ZONE ?? "Europe/Paris";
  const currentDate = currentDateForTimeZone(now(), timeZone);
  const previousDate = defaultDateForTimeZone(now(), timeZone);
  return previousDate === currentDate ? [currentDate] : [previousDate, currentDate];
}

function publicErrorCode(error: unknown): string {
  if (error instanceof GoogleHealthFetchError) {
    return error.code;
  }

  if (error instanceof DatabaseConfigError) {
    return "database_env_missing";
  }

  if (error instanceof Error && error.name === "HealthConfigError") {
    return "health_env_missing";
  }

  return "health_cron_failed";
}

export async function handleHealthCronRequest(
  request: Request,
  { env, now = () => new Date(), healthClient, store }: HealthCronRequestDeps,
): Promise<Response> {
  const auth = requireBearerToken(request, env, "CRON_SECRET");
  if (!auth.ok) {
    return auth.response;
  }

  const dates = getRequestedDates(request, env, now);
  if (dates.some((date) => !isIsoDate(date))) {
    return Response.json({ error: "invalid_date", expected: "YYYY-MM-DD" }, { status: 400 });
  }

  try {
    const healthStore = store ?? createHealthStore(env);
    await healthStore.ensureSchema();

    const records = [];
    for (const date of dates) {
      const snapshot = await fetchHealthSnapshot({
        date,
        env,
        now,
        healthClient,
      });
      records.push(await healthStore.upsertDailySnapshot(snapshot));
    }

    return Response.json({
      ok: true,
      records: records.map((record) => ({
        date: record.date,
        fetchedAt: record.fetchedAt,
        updatedAt: record.updatedAt,
      })),
    });
  } catch (error) {
    const code = publicErrorCode(error);
    const status = code === "health_cron_failed" ? 502 : 500;

    return Response.json({ error: "health_cron_failed", code }, { status });
  }
}
