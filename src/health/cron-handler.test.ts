import { describe, expect, it, vi } from "vitest";
import { handleHealthCronRequest } from "./cron-handler";
import type { Env, GoogleHealthClient, HealthSnapshot, HealthStore } from "./types";

const env: Env = {
  CRON_SECRET: "cron-secret",
  GOOGLE_HEALTH_TIME_ZONE: "Europe/Paris",
};

function request(path: string, token = "cron-secret") {
  return new Request(`https://example.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

function createMockClient(): GoogleHealthClient {
  return {
    getAccessToken: vi.fn(async () => "access-token"),
    getDailyRollup: vi.fn(async (dataType) => {
      if (dataType === "steps") {
        return { rollupDataPoints: [{ steps: { countSum: "1234" } }] };
      }

      return {
        rollupDataPoints: [
          {
            activeMinutes: {
              activeMinutesRollupByActivityLevel: [
                { activityLevel: "LIGHT", activeMinutesSum: "10" },
                { activityLevel: "MODERATE", activeMinutesSum: "32" },
              ],
            },
          },
        ],
      };
    }),
    getSleepData: vi.fn(async () => ({
      dataPoints: [
        {
          sleep: {
            metadata: { main: true },
            summary: { minutesInSleepPeriod: "464" },
          },
        },
      ],
    })),
  };
}

function createMockStore(): HealthStore {
  return {
    ensureSchema: vi.fn(async () => undefined),
    upsertDailySnapshot: vi.fn(async (snapshot: HealthSnapshot) => ({
      ...snapshot,
      storedAt: "2026-06-23T12:00:00.000Z",
      updatedAt: "2026-06-23T12:00:01.000Z",
    })),
    listDailySnapshots: vi.fn(),
  };
}

describe("handleHealthCronRequest", () => {
  it("rejects requests without the cron token", async () => {
    const response = await handleHealthCronRequest(new Request("https://example.com/api"), {
      env,
      healthClient: createMockClient(),
      store: createMockStore(),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("rejects invalid dates before fetching or storing", async () => {
    const client = createMockClient();
    const store = createMockStore();
    const response = await handleHealthCronRequest(request("/api?date=2026-99-99"), {
      env,
      healthClient: client,
      store,
    });

    expect(response.status).toBe(400);
    expect(client.getAccessToken).not.toHaveBeenCalled();
    expect(store.ensureSchema).not.toHaveBeenCalled();
  });

  it("fetches and stores the requested daily snapshot", async () => {
    const client = createMockClient();
    const store = createMockStore();
    const response = await handleHealthCronRequest(request("/api?date=2026-06-22"), {
      env,
      now: () => new Date("2026-06-23T12:00:00.000Z"),
      healthClient: client,
      store,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      records: [
        {
          date: "2026-06-22",
          fetchedAt: "2026-06-23T12:00:00.000Z",
          updatedAt: "2026-06-23T12:00:01.000Z",
        },
      ],
    });

    expect(store.ensureSchema).toHaveBeenCalledOnce();
    expect(store.upsertDailySnapshot).toHaveBeenCalledWith({
      date: "2026-06-22",
      steps: 1234,
      timeInBedMinutes: 464,
      activeMinutes: {
        total: 42,
        byLevel: {
          light: 10,
          moderate: 32,
        },
      },
      unavailable: {},
      fetchedAt: "2026-06-23T12:00:00.000Z",
    });
  });

  it("stores yesterday and today when no date is requested", async () => {
    const client = createMockClient();
    const store = createMockStore();
    const response = await handleHealthCronRequest(request("/api"), {
      env,
      now: () => new Date("2026-06-23T12:00:00.000Z"),
      healthClient: client,
      store,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      records: [
        {
          date: "2026-06-22",
          fetchedAt: "2026-06-23T12:00:00.000Z",
          updatedAt: "2026-06-23T12:00:01.000Z",
        },
        {
          date: "2026-06-23",
          fetchedAt: "2026-06-23T12:00:00.000Z",
          updatedAt: "2026-06-23T12:00:01.000Z",
        },
      ],
    });

    expect(store.upsertDailySnapshot).toHaveBeenCalledTimes(2);
  });

  it("returns sanitized database configuration errors", async () => {
    const response = await handleHealthCronRequest(request("/api?date=2026-06-22"), {
      env,
      healthClient: createMockClient(),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "health_cron_failed",
      code: "database_env_missing",
    });
  });
});
