import { describe, expect, it } from "vitest";
import {
  createEmptyRescueTimeComputerStats,
  normalizeRescueTimeComputerStats,
} from "./normalizers";

describe("normalizeRescueTimeComputerStats", () => {
  it("returns only public-safe computer totals grouped by productivity class", () => {
    const stats = normalizeRescueTimeComputerStats(
      {
        row_headers: [
          "Date",
          "Time Spent (seconds)",
          "Number of People",
          "Productivity",
          "Activity",
          "Document",
        ],
        rows: [
          ["2026-06-24T00:00:00", 1200, 1, 2, "private-app", "secret-document"],
          ["2026-06-24T00:00:00", 600, 1, 1, "private-site", "secret-page"],
          ["2026-06-24T00:00:00", 300, 1, 0, "private-neutral", "secret-tab"],
          ["2026-06-24T00:00:00", 900, 1, -1, "private-feed", "secret-feed"],
          ["2026-06-24T00:00:00", 600, 1, -2, "private-video", "secret-video"],
        ],
      },
      {
        date: "2026-06-24",
        fetchedAt: "2026-06-24T10:00:00.000Z",
      },
    );

    expect(stats).toEqual({
      date: "2026-06-24",
      total: { totalSeconds: 3600, text: "1h 00m" },
      productive: { totalSeconds: 1800, text: "30m" },
      neutral: { totalSeconds: 300, text: "5m" },
      distracting: { totalSeconds: 1500, text: "25m" },
      fetchedAt: "2026-06-24T10:00:00.000Z",
      unavailableReason: undefined,
    });
    expect(JSON.stringify(stats)).not.toContain("private");
    expect(JSON.stringify(stats)).not.toContain("secret");
  });

  it("keeps malformed rows as zero without throwing", () => {
    const stats = normalizeRescueTimeComputerStats(
      {
        row_headers: ["Date", "Time Spent (seconds)", "Productivity"],
        rows: [
          ["2026-06-24T00:00:00", "bad", 2],
          ["2026-06-24T00:00:00", 200, "bad"],
          null,
        ],
      },
      {
        date: "2026-06-24",
        fetchedAt: "2026-06-24T10:00:00.000Z",
      },
    );

    expect(stats.total).toEqual({ totalSeconds: 0, text: "0m" });
    expect(stats.productive).toEqual({ totalSeconds: 0, text: "0m" });
    expect(stats.neutral).toEqual({ totalSeconds: 0, text: "0m" });
    expect(stats.distracting).toEqual({ totalSeconds: 0, text: "0m" });
  });
});

describe("createEmptyRescueTimeComputerStats", () => {
  it("creates a zeroed public payload", () => {
    expect(
      createEmptyRescueTimeComputerStats({
        date: "2026-06-24",
        fetchedAt: null,
        unavailableReason: "missing_api_key",
      }),
    ).toEqual({
      date: "2026-06-24",
      total: { totalSeconds: 0, text: "0m" },
      productive: { totalSeconds: 0, text: "0m" },
      neutral: { totalSeconds: 0, text: "0m" },
      distracting: { totalSeconds: 0, text: "0m" },
      fetchedAt: null,
      unavailableReason: "missing_api_key",
    });
  });
});
