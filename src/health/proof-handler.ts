import { defaultDateForTimeZone, isIsoDate } from "./date";
import { fetchHealthSnapshot } from "./collect";
import { GoogleHealthFetchError } from "./google-health-client";
import { requireBearerToken } from "./auth";
import type { Env, GoogleHealthClient, HealthProofPayload } from "./types";

type HealthProofRequestDeps = {
  env: Env;
  now?: () => Date;
  healthClient?: GoogleHealthClient;
};

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, { status });
}

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

  if (error instanceof Error && error.name === "HealthConfigError") {
    return "health_env_missing";
  }

  return "health_fetch_failed";
}

export async function handleHealthProofRequest(
  request: Request,
  { env, now = () => new Date(), healthClient }: HealthProofRequestDeps,
): Promise<Response> {
  const auth = requireBearerToken(request, env, "HEALTH_PROOF_ADMIN_TOKEN");
  if (!auth.ok) {
    return auth.response;
  }

  const date = getRequestedDate(request, env, now);
  if (!isIsoDate(date)) {
    return json({ error: "invalid_date", expected: "YYYY-MM-DD" }, 400);
  }

  try {
    const payload: HealthProofPayload = await fetchHealthSnapshot({
      date,
      env,
      now,
      healthClient,
    });

    return json(payload);
  } catch (error) {
    const code = publicErrorCode(error);

    if (code === "health_env_missing") {
      return json({ error: "server_misconfigured", code }, 500);
    }

    return json({ error: "health_fetch_failed", code }, 502);
  }
}
