import { describe, expect, it } from "vitest";
import { summarizeTrackedActiveMinutes, toTrackedActiveMinuteLevel } from "./active-minutes";

describe("toTrackedActiveMinuteLevel", () => {
  it("keeps only moderate, vigorous, and very active levels", () => {
    expect(toTrackedActiveMinuteLevel("LIGHT")).toBeNull();
    expect(toTrackedActiveMinuteLevel("MODERATE")).toBe("moderate");
    expect(toTrackedActiveMinuteLevel("VIGOROUS")).toBe("vigorous");
    expect(toTrackedActiveMinuteLevel("VERY_ACTIVE")).toBe("very_active");
    expect(toTrackedActiveMinuteLevel("ACTIVE_MINUTES_ACTIVITY_LEVEL_VERY_ACTIVE")).toBe(
      "very_active",
    );
  });
});

describe("summarizeTrackedActiveMinutes", () => {
  it("merges tracked levels and drops light minutes", () => {
    expect(
      summarizeTrackedActiveMinutes({
        light: 10,
        moderate: 32,
        vigorous: 8,
        very_active: 4,
      }),
    ).toEqual({
      total: 44,
      byLevel: {
        moderate: 32,
        vigorous: 8,
        very_active: 4,
      },
    });
  });
});
