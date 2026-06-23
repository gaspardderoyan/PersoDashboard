import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearWakaTimeCodingStatsCache, getPublicWakaTimeCodingStats } from "./public-data";
import type { WakaTimeFetch } from "./types";

const NOW = new Date("2026-06-23T10:00:00.000Z");

describe("getPublicWakaTimeCodingStats", () => {
  beforeEach(() => {
    clearWakaTimeCodingStatsCache();
  });

  it("returns a safe empty payload when WAKATIME_API_KEY is missing", async () => {
    const fetchImpl = vi.fn<WakaTimeFetch>();
    const stats = await getPublicWakaTimeCodingStats({
      env: {},
      fetchImpl,
      now: NOW,
      cacheTtlMs: 0,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(stats.unavailableReason).toBe("missing_api_key");
    expect(stats.dailyTotals).toHaveLength(30);
    expect(stats.todayTotal).toEqual({ totalSeconds: 0, text: "0m" });
    expect(stats.topLanguages).toEqual([]);
    expect(stats.topEditors).toEqual([]);
  });

  it("returns a safe empty payload when WakaTime is recalculating", async () => {
    const fetchImpl = vi.fn<WakaTimeFetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    const stats = await getPublicWakaTimeCodingStats({
      env: { WAKATIME_API_KEY: "waka_test" },
      fetchImpl,
      now: NOW,
      cacheTtlMs: 0,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(stats.unavailableReason).toBe("fetch_failed");
    expect(stats.fetchedAt).toBeNull();
  });

  it("returns a safe empty payload when the WakaTime request fails", async () => {
    const fetchImpl = vi.fn<WakaTimeFetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "server unavailable" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    const stats = await getPublicWakaTimeCodingStats({
      env: { WAKATIME_API_KEY: "waka_test" },
      fetchImpl,
      now: NOW,
      cacheTtlMs: 0,
    });

    expect(stats.unavailableReason).toBe("fetch_failed");
    expect(stats.todayTotal).toEqual({ totalSeconds: 0, text: "0m" });
  });
});
