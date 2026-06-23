import { describe, expect, it } from "vitest";
import { normalizeActiveMinutes, normalizeSteps, normalizeTimeInBed } from "./normalizers";

describe("normalizeSteps", () => {
  it("returns summed steps from rollup data", () => {
    expect(
      normalizeSteps({
        rollupDataPoints: [{ steps: { countSum: "1200" } }, { steps: { countSum: "34" } }],
      }),
    ).toEqual({ value: 1234 });
  });

  it("keeps true zero values", () => {
    expect(normalizeSteps({ rollupDataPoints: [{ steps: { countSum: "0" } }] })).toEqual({
      value: 0,
    });
  });

  it("returns an unavailable reason when steps are missing", () => {
    expect(normalizeSteps({ rollupDataPoints: [{}] })).toEqual({
      value: null,
      unavailableReason: "no_steps_data",
    });
  });

  it("returns an unavailable reason for malformed counts", () => {
    expect(normalizeSteps({ rollupDataPoints: [{ steps: { countSum: "nan" } }] })).toEqual({
      value: null,
      unavailableReason: "invalid_steps_data",
    });
  });
});

describe("normalizeActiveMinutes", () => {
  it("returns totals and minutes by activity level", () => {
    expect(
      normalizeActiveMinutes({
        rollupDataPoints: [
          {
            activeMinutes: {
              activeMinutesRollupByActivityLevel: [
                { activityLevel: "LIGHT", activeMinutesSum: "12" },
                { activityLevel: "MODERATE", activeMinutesSum: "20" },
              ],
            },
          },
        ],
      }),
    ).toEqual({
      value: {
        total: 32,
        byLevel: {
          light: 12,
          moderate: 20,
        },
      },
    });
  });

  it("keeps zero active minutes when the active minutes object is present", () => {
    expect(
      normalizeActiveMinutes({
        rollupDataPoints: [{ activeMinutes: { activeMinutesRollupByActivityLevel: [] } }],
      }),
    ).toEqual({ value: { total: 0, byLevel: {} } });
  });

  it("returns an unavailable reason when active minutes are missing", () => {
    expect(normalizeActiveMinutes({ rollupDataPoints: [{}] })).toEqual({
      value: null,
      unavailableReason: "no_active_minutes_data",
    });
  });

  it("returns an unavailable reason for malformed active minutes", () => {
    expect(
      normalizeActiveMinutes({
        rollupDataPoints: [
          {
            activeMinutes: {
              activeMinutesRollupByActivityLevel: [
                { activityLevel: "LIGHT", activeMinutesSum: "bad" },
              ],
            },
          },
        ],
      }),
    ).toEqual({
      value: null,
      unavailableReason: "invalid_active_minutes_data",
    });
  });
});

describe("normalizeTimeInBed", () => {
  it("uses the main non-nap sleep period", () => {
    expect(
      normalizeTimeInBed({
        dataPoints: [
          { sleep: { metadata: { nap: true }, summary: { minutesInSleepPeriod: "35" } } },
          { sleep: { metadata: { main: true }, summary: { minutesInSleepPeriod: "464" } } },
        ],
      }),
    ).toEqual({ value: 464 });
  });

  it("falls back to the longest non-nap sleep period", () => {
    expect(
      normalizeTimeInBed({
        dataPoints: [
          { sleep: { summary: { minutesInSleepPeriod: "120" } } },
          { sleep: { summary: { minutesInSleepPeriod: "405" } } },
        ],
      }),
    ).toEqual({ value: 405 });
  });

  it("returns an unavailable reason when sleep data is missing", () => {
    expect(normalizeTimeInBed({ dataPoints: [] })).toEqual({
      value: null,
      unavailableReason: "no_sleep_data",
    });
  });

  it("returns an unavailable reason when sleep data is malformed", () => {
    expect(normalizeTimeInBed({ dataPoints: [{ sleep: { summary: {} } }] })).toEqual({
      value: null,
      unavailableReason: "no_sleep_data",
    });
  });
});
