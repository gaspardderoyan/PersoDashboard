import { describe, expect, it } from "vitest";
import {
  createEmptyFortyTwoDashboardStats,
  extractFortyTwoProfile,
  normalizeFortyTwoDashboardStats,
  parseFortyTwoLogtimeMinutes,
} from "./normalizers";

describe("parseFortyTwoLogtimeMinutes", () => {
  it("parses 42 duration strings to rounded minutes", () => {
    expect(parseFortyTwoLogtimeMinutes("03:34:28.923297")).toBe(214);
    expect(parseFortyTwoLogtimeMinutes("00:00:31")).toBe(1);
    expect(parseFortyTwoLogtimeMinutes("bad")).toBe(0);
    expect(parseFortyTwoLogtimeMinutes(null)).toBe(0);
  });
});

describe("extractFortyTwoProfile", () => {
  it("extracts only public-safe current profile and common-core cohort metadata", () => {
    const profile = extractFortyTwoProfile(
      {
        login: "gderoyan",
        email: "private@example.com",
        campus: [{ id: 1, name: "Paris", address: "secret" }],
        campus_users: [{ campus_id: 1, is_primary: true }],
        cursus_users: [
          {
            level: 4.51,
            grade: "Cadet",
            begin_at: "2025-11-10T09:00:00.000Z",
            end_at: null,
            user: { login: "gderoyan" },
            cursus_id: 21,
            cursus: { id: 21, name: "42cursus" },
          },
        ],
      },
      "fallback",
    );

    expect(profile).toEqual({
      login: "gderoyan",
      campus: "Paris",
      campusId: 1,
      cursus: "42cursus",
      cursusId: 21,
      grade: "Cadet",
      level: 4.51,
      cohortStartDate: "2025-11-01",
      cohortEndDate: "2025-11-30",
      cohortLabel: "Nov 2025 common-core cohort",
    });
    expect(JSON.stringify(profile)).not.toContain("private@example.com");
    expect(JSON.stringify(profile)).not.toContain("secret");
  });
});

describe("normalizeFortyTwoDashboardStats", () => {
  it("returns public logtime, current level, cohort rank, and stored progression", () => {
    const stats = normalizeFortyTwoDashboardStats({
      login: "gderoyan",
      startDate: "2026-06-22",
      endDate: "2026-06-24",
      fetchedAt: "2026-06-24T12:00:00.000Z",
      locationStatsPayload: {
        "2026-06-22": "01:30:00.000000",
        "2026-06-24": "00:45:30.000000",
      },
      userPayload: {
        login: "gderoyan",
        campus: [{ id: 1, name: "Paris" }],
        campus_users: [{ campus_id: 1, is_primary: true }],
        cursus_users: [
          {
            level: 4.51,
            grade: "Cadet",
            begin_at: "2025-11-10T09:00:00.000Z",
            end_at: null,
            cursus_id: 21,
            cursus: { id: 21, name: "42cursus" },
          },
        ],
        locations: [{ host: "hidden-host" }],
      },
      rankAboveCount: 22,
      rankPopulation: 80,
      snapshots: [
        {
          date: "2026-06-23",
          logtimeMinutes: 0,
          level: 4.32,
          rank: 25,
          cohortPopulation: 80,
          cohortLabel: "Nov 2025 common-core cohort",
          fetchedAt: "2026-06-23T12:00:00.000Z",
        },
        {
          date: "2026-06-24",
          logtimeMinutes: 46,
          level: 4.51,
          rank: 23,
          cohortPopulation: 80,
          cohortLabel: "Nov 2025 common-core cohort",
          fetchedAt: "2026-06-24T12:00:00.000Z",
        },
      ],
    });

    expect(stats.dailyLogtime).toEqual([
      { date: "2026-06-22", totalMinutes: 90, text: "1h 30m" },
      { date: "2026-06-23", totalMinutes: 0, text: "0m" },
      { date: "2026-06-24", totalMinutes: 46, text: "46m" },
    ]);
    expect(stats.todayLogtime).toEqual({ totalMinutes: 46, text: "46m" });
    expect(stats.last30Logtime).toEqual({ totalMinutes: 136, text: "2h 16m" });
    expect(stats.level).toBe(4.51);
    expect(stats.cohortRank).toEqual({
      rank: 23,
      population: 80,
      percentile: 72.2,
      label: "Nov 2025 common-core cohort",
    });
    expect(stats.levelProgression).toEqual([
      { date: "2026-06-23", level: 4.32 },
      { date: "2026-06-24", level: 4.51 },
    ]);
    expect(stats.rankProgression).toEqual([
      { date: "2026-06-23", rank: 25, population: 80, percentile: 69.6 },
      { date: "2026-06-24", rank: 23, population: 80, percentile: 72.2 },
    ]);
    expect(JSON.stringify(stats)).not.toContain("hidden-host");
  });
});

describe("createEmptyFortyTwoDashboardStats", () => {
  it("creates an unavailable payload for the requested date range", () => {
    expect(
      createEmptyFortyTwoDashboardStats({
        login: "gderoyan",
        startDate: "2026-06-22",
        endDate: "2026-06-24",
        fetchedAt: null,
        unavailableReason: "missing_credentials",
      }),
    ).toEqual({
      login: "gderoyan",
      campus: null,
      cursus: null,
      grade: null,
      level: null,
      todayLogtime: { totalMinutes: 0, text: "0m" },
      last30Logtime: { totalMinutes: 0, text: "0m" },
      activeDayAverage: { totalMinutes: 0, text: "0m" },
      dailyLogtime: [
        { date: "2026-06-22", totalMinutes: 0, text: "0m" },
        { date: "2026-06-23", totalMinutes: 0, text: "0m" },
        { date: "2026-06-24", totalMinutes: 0, text: "0m" },
      ],
      cohortRank: {
        rank: null,
        population: null,
        percentile: null,
        label: "common-core cohort",
      },
      levelProgression: [],
      rankProgression: [],
      fetchedAt: null,
      unavailableReason: "missing_credentials",
    });
  });
});

