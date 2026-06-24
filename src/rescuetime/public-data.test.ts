import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRescueTimeComputerStatsCache,
  getPublicRescueTimeComputerStats,
} from "./public-data";
import type { RescueTimeFetch } from "./types";

const NOW = new Date("2026-06-24T10:00:00.000Z");

describe("getPublicRescueTimeComputerStats", () => {
  beforeEach(() => {
    clearRescueTimeComputerStatsCache();
  });

  it("returns a safe empty payload when RESCUETIME_API_KEY is missing", async () => {
    const fetchImpl = vi.fn<RescueTimeFetch>();
    const stats = await getPublicRescueTimeComputerStats({
      env: {},
      fetchImpl,
      now: NOW,
      cacheTtlMs: 0,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(stats.unavailableReason).toBe("missing_api_key");
    expect(stats.total).toEqual({ totalSeconds: 0, text: "0m" });
    expect(stats.productive).toEqual({ totalSeconds: 0, text: "0m" });
    expect(stats.neutral).toEqual({ totalSeconds: 0, text: "0m" });
    expect(stats.distracting).toEqual({ totalSeconds: 0, text: "0m" });
  });

  it("requests only computer productivity totals without putting the key in the URL", async () => {
    const fetchImpl = vi.fn<RescueTimeFetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          row_headers: ["Date", "Time Spent (seconds)", "Number of People", "Productivity"],
          rows: [
            ["2026-06-24T00:00:00", 1200, 1, 2],
            ["2026-06-24T00:00:00", 600, 1, -2],
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const stats = await getPublicRescueTimeComputerStats({
      env: { RESCUETIME_API_KEY: "rt_test" },
      fetchImpl,
      now: NOW,
      cacheTtlMs: 0,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    const requestUrl = url as URL;

    expect(requestUrl.searchParams.get("restrict_source_type")).toBe("computers");
    expect(requestUrl.searchParams.get("restrict_kind")).toBe("productivity");
    expect(requestUrl.searchParams.get("restrict_begin")).toBe("2026-06-24");
    expect(requestUrl.searchParams.get("restrict_end")).toBe("2026-06-24");
    expect(requestUrl.searchParams.has("key")).toBe(false);
    expect(init?.headers).toEqual({
      Authorization: "Bearer rt_test",
      Accept: "application/json",
    });
    expect(stats.total).toEqual({ totalSeconds: 1800, text: "30m" });
    expect(stats.productive).toEqual({ totalSeconds: 1200, text: "20m" });
    expect(stats.distracting).toEqual({ totalSeconds: 600, text: "10m" });
  });

  it("returns a safe empty payload when the RescueTime request fails", async () => {
    const fetchImpl = vi.fn<RescueTimeFetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "server unavailable" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    const stats = await getPublicRescueTimeComputerStats({
      env: { RESCUETIME_API_KEY: "rt_test" },
      fetchImpl,
      now: NOW,
      cacheTtlMs: 0,
    });

    expect(stats.unavailableReason).toBe("fetch_failed");
    expect(stats.fetchedAt).toBeNull();
    expect(stats.total).toEqual({ totalSeconds: 0, text: "0m" });
  });
});
