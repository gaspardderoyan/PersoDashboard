import { addDays, toCivilDateTime } from "./date";
import type { Env, GoogleHealthClient, GoogleHealthDataType } from "./types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const HEALTH_API_BASE_URL = "https://health.googleapis.com/v4";

class HealthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HealthConfigError";
  }
}

export class GoogleHealthFetchError extends Error {
  constructor(
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(code);
    this.name = "GoogleHealthFetchError";
  }
}

function requireEnv(env: Env, key: string): string {
  const value = env[key];

  if (!value) {
    throw new HealthConfigError(`Missing ${key}`);
  }

  return value;
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createGoogleHealthClient(
  env: Env,
  fetchFn: typeof fetch = fetch,
): GoogleHealthClient {
  const clientId = requireEnv(env, "GOOGLE_HEALTH_CLIENT_ID");
  const clientSecret = requireEnv(env, "GOOGLE_HEALTH_CLIENT_SECRET");
  const refreshToken = requireEnv(env, "GOOGLE_HEALTH_REFRESH_TOKEN");

  return {
    async getAccessToken() {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      });

      const response = await fetchFn(TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const payload = await parseJson(response);

      if (!response.ok) {
        throw new GoogleHealthFetchError("token_exchange_failed", response.status);
      }

      if (
        typeof payload !== "object" ||
        payload === null ||
        !("access_token" in payload) ||
        typeof payload.access_token !== "string"
      ) {
        throw new GoogleHealthFetchError("token_exchange_missing_access_token", response.status);
      }

      return payload.access_token;
    },

    async getDailyRollup(dataType: GoogleHealthDataType, date: string, accessToken: string) {
      const response = await fetchFn(
        `${HEALTH_API_BASE_URL}/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            range: {
              start: toCivilDateTime(date),
              end: toCivilDateTime(addDays(date, 1)),
            },
            windowSizeDays: 1,
            dataSourceFamily: "users/me/dataSourceFamilies/google-wearables",
          }),
        },
      );

      const payload = await parseJson(response);

      if (!response.ok) {
        throw new GoogleHealthFetchError(`${dataType}_rollup_failed`, response.status);
      }

      return payload;
    },

    async getSleepData(date: string, accessToken: string) {
      const nextDate = addDays(date, 1);
      const params = new URLSearchParams({
        dataSourceFamily: "users/me/dataSourceFamilies/google-wearables",
        pageSize: "10",
        filter: `sleep.interval.civil_end_time >= "${date}T00:00:00" AND sleep.interval.civil_end_time < "${nextDate}T00:00:00"`,
      });

      const response = await fetchFn(
        `${HEALTH_API_BASE_URL}/users/me/dataTypes/sleep/dataPoints:reconcile?${params}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        },
      );

      const payload = await parseJson(response);

      if (!response.ok) {
        throw new GoogleHealthFetchError("sleep_reconcile_failed", response.status);
      }

      return payload;
    },
  };
}
