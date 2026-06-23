import { defaultDateForTimeZone, isIsoDate } from "./date";
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

function getRequestedDate(request: Request, env: Env, now: () => Date): string {
  const url = new URL(request.url);
  const requestedDate = url.searchParams.get("date");

  if (requestedDate) {
    return requestedDate;
  }

  return defaultDateForTimeZone(now(), env.GOOGLE_HEALTH_TIME_ZONE ?? "Europe/Paris");
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

  const date = getRequestedDate(request, env, now);
  if (!isIsoDate(date)) {
    return Response.json({ error: "invalid_date", expected: "YYYY-MM-DD" }, { status: 400 });
  }

  try {
    const healthStore = store ?? createHealthStore(env);
    await healthStore.ensureSchema();

    const snapshot = await fetchHealthSnapshot({
      date,
      env,
      now,
      healthClient,
    });

    const record = await healthStore.upsertDailySnapshot(snapshot);

    return Response.json({
      ok: true,
      date: record.date,
      fetchedAt: record.fetchedAt,
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    const code = publicErrorCode(error);
    const status = code === "health_cron_failed" ? 502 : 500;

    return Response.json({ error: "health_cron_failed", code }, { status });
  }
}
