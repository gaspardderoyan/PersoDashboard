import { describe, expect, it, vi } from "vitest";
import { handleHealthProofRequest } from "./proof-handler";
import type { Env, GoogleHealthClient } from "./types";

const env: Env = {
  HEALTH_PROOF_ADMIN_TOKEN: "admin-secret",
  GOOGLE_HEALTH_TIME_ZONE: "Europe/Paris",
};

function request(path: string, token = "admin-secret") {
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

describe("handleHealthProofRequest", () => {
  it("rejects requests without the admin token", async () => {
    const response = await handleHealthProofRequest(new Request("https://example.com/api"), {
      env,
      healthClient: createMockClient(),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("rejects invalid dates before calling Google Health", async () => {
    const client = createMockClient();
    const response = await handleHealthProofRequest(request("/api?date=2026-99-99"), {
      env,
      healthClient: client,
    });

    expect(response.status).toBe(400);
    expect(client.getAccessToken).not.toHaveBeenCalled();
  });

  it("returns normalized health proof data", async () => {
    const client = createMockClient();
    const response = await handleHealthProofRequest(request("/api?date=2026-06-22"), {
      env,
      now: () => new Date("2026-06-23T12:00:00.000Z"),
      healthClient: client,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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

    expect(client.getAccessToken).toHaveBeenCalledOnce();
    expect(client.getDailyRollup).toHaveBeenCalledWith("steps", "2026-06-22", "access-token");
    expect(client.getDailyRollup).toHaveBeenCalledWith(
      "active-minutes",
      "2026-06-22",
      "access-token",
    );
    expect(client.getSleepData).toHaveBeenCalledWith("2026-06-22", "access-token");
  });

  it("returns sanitized fetch errors", async () => {
    const client = createMockClient();
    vi.mocked(client.getAccessToken).mockRejectedValueOnce(new Error("raw secret-ish detail"));

    const response = await handleHealthProofRequest(request("/api?date=2026-06-22"), {
      env,
      healthClient: client,
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "health_fetch_failed",
      code: "health_fetch_failed",
    });
  });

  it("returns sanitized configuration errors", async () => {
    const response = await handleHealthProofRequest(request("/api?date=2026-06-22"), {
      env,
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "server_misconfigured",
      code: "health_env_missing",
    });
  });
});
