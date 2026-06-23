import { describe, expect, it } from "vitest";
import { createEmptyWakaTimeCodingStats, normalizeWakaTimeSummaries } from "./normalizers";

describe("normalizeWakaTimeSummaries", () => {
  it("returns public-safe daily totals with aggregated languages and editors", () => {
    const stats = normalizeWakaTimeSummaries(
      {
        data: [
          {
            range: { date: "2026-06-21" },
            grand_total: { total_seconds: 3600, text: "1 hr" },
            languages: [
              { name: "TypeScript", total_seconds: 1800, color: "#3178c6" },
              { name: "Rust", total_seconds: 1800, color: "#dea584" },
            ],
            editors: [{ name: "VS Code", total_seconds: 3600, color: "#007acc" }],
            projects: [{ name: "private-client", total_seconds: 3600 }],
            machines: [{ name: "MacBook.local", total_seconds: 3600 }],
          },
          {
            range: { date: "2026-06-22" },
            grand_total: { total_seconds: 0, text: "0 secs" },
          },
          {
            range: { date: "2026-06-23" },
            grand_total: { total_seconds: 7200, text: "2 hrs" },
            languages: [{ name: "TypeScript", total_seconds: 7200, color: "#3178c6" }],
            editors: [{ name: "Neovim", total_seconds: 7200, color: "#57a143" }],
          },
        ],
      },
      {
        startDate: "2026-06-21",
        endDate: "2026-06-23",
        fetchedAt: "2026-06-23T10:00:00.000Z",
      },
    );

    expect(stats.dailyTotals).toEqual([
      { date: "2026-06-21", totalSeconds: 3600, text: "1 hr" },
      { date: "2026-06-22", totalSeconds: 0, text: "0 secs" },
      { date: "2026-06-23", totalSeconds: 7200, text: "2 hrs" },
    ]);
    expect(stats.todayTotal).toEqual({ totalSeconds: 7200, text: "2 hrs" });
    expect(stats.last7Total).toEqual({ totalSeconds: 10800, text: "3h 00m" });
    expect(stats.activeDayAverage).toEqual({ totalSeconds: 5400, text: "1h 30m" });
    expect(stats.topLanguages).toEqual([
      { name: "TypeScript", totalSeconds: 9000, text: "2h 30m", percent: 83.3, color: "#3178c6" },
      { name: "Rust", totalSeconds: 1800, text: "30m", percent: 16.7, color: "#dea584" },
    ]);
    expect(stats.topEditors).toEqual([
      { name: "Neovim", totalSeconds: 7200, text: "2h 00m", percent: 66.7, color: "#57a143" },
      { name: "VS Code", totalSeconds: 3600, text: "1h 00m", percent: 33.3, color: "#007acc" },
    ]);
    expect(JSON.stringify(stats)).not.toContain("private-client");
    expect(JSON.stringify(stats)).not.toContain("MacBook.local");
  });

  it("keeps empty and malformed summary days as zero without throwing", () => {
    const stats = normalizeWakaTimeSummaries(
      {
        data: [
          {
            range: { date: "2026-06-22" },
            grand_total: {},
            languages: [{ name: "TypeScript", total_seconds: "bad" }],
            editors: null,
          },
        ],
      },
      {
        startDate: "2026-06-21",
        endDate: "2026-06-23",
        fetchedAt: "2026-06-23T10:00:00.000Z",
      },
    );

    expect(stats.dailyTotals).toEqual([
      { date: "2026-06-21", totalSeconds: 0, text: "0m" },
      { date: "2026-06-22", totalSeconds: 0, text: "0m" },
      { date: "2026-06-23", totalSeconds: 0, text: "0m" },
    ]);
    expect(stats.topLanguages).toEqual([]);
    expect(stats.topEditors).toEqual([]);
    expect(stats.activeDayAverage).toEqual({ totalSeconds: 0, text: "0m" });
  });
});

describe("createEmptyWakaTimeCodingStats", () => {
  it("creates a zeroed public payload for the requested date range", () => {
    expect(
      createEmptyWakaTimeCodingStats({
        startDate: "2026-06-21",
        endDate: "2026-06-23",
        fetchedAt: null,
        unavailableReason: "missing_api_key",
      }),
    ).toEqual({
      todayTotal: { totalSeconds: 0, text: "0m" },
      last7Total: { totalSeconds: 0, text: "0m" },
      activeDayAverage: { totalSeconds: 0, text: "0m" },
      dailyTotals: [
        { date: "2026-06-21", totalSeconds: 0, text: "0m" },
        { date: "2026-06-22", totalSeconds: 0, text: "0m" },
        { date: "2026-06-23", totalSeconds: 0, text: "0m" },
      ],
      topLanguages: [],
      topEditors: [],
      fetchedAt: null,
      unavailableReason: "missing_api_key",
    });
  });
});
