import { addDays, getDateRange } from "../wakatime/date";
import type {
  FortyTwoCohortRank,
  FortyTwoDailyLogtime,
  FortyTwoDailySnapshot,
  FortyTwoTotal,
  PublicFortyTwoDashboardStats,
} from "./types";

const ZERO_TOTAL: FortyTwoTotal = {
  totalMinutes: 0,
  text: "0m",
};

type FortyTwoProfile = {
  login: string;
  campus: string | null;
  campusId: number | null;
  cursus: string | null;
  cursusId: number | null;
  grade: string | null;
  level: number | null;
  cohortStartDate: string | null;
  cohortEndDate: string | null;
  cohortLabel: string;
};

type NormalizeOptions = {
  login: string;
  startDate: string;
  endDate: string;
  fetchedAt: string | null;
  unavailableReason?: string;
  rankAboveCount?: number | null;
  rankPopulation?: number | null;
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function toOptionalIsoDate(value: unknown): string | null {
  const text = toOptionalString(value);
  return text && /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

function monthEndDate(startDate: string): string {
  const [year, month] = startDate.split("-").map(Number);
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  return addDays(nextMonth, -1);
}

function formatCohortLabel(startDate: string | null): string {
  if (!startDate) {
    return "common-core cohort";
  }

  const monthIndex = Number(startDate.slice(5, 7)) - 1;
  const year = startDate.slice(0, 4);
  const month = MONTH_LABELS[monthIndex] ?? startDate.slice(5, 7);

  return `${month} ${year} common-core cohort`;
}

export function formatFortyTwoDuration(totalMinutes: number): string {
  const roundedMinutes = Math.round(Math.max(0, totalMinutes));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function makeTotal(totalMinutes: number): FortyTwoTotal {
  return {
    totalMinutes,
    text: formatFortyTwoDuration(totalMinutes),
  };
}

export function parseFortyTwoLogtimeMinutes(value: unknown): number {
  const text = toOptionalString(value);

  if (!text) {
    return 0;
  }

  const [hours = "0", minutes = "0", seconds = "0"] = text.split(":");
  const totalSeconds =
    Number(hours) * 3600 + Number(minutes) * 60 + Number.parseFloat(seconds);

  return Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.round(totalSeconds / 60) : 0;
}

function getCursusName(rawCursus: Record<string, unknown> | null): string | null {
  return toOptionalString(rawCursus?.name) ?? toOptionalString(rawCursus?.slug);
}

export function extractFortyTwoProfile(payload: unknown, login: string): FortyTwoProfile {
  const root = toRecord(payload);
  const campusUsers = toArray(root?.campus_users).flatMap((rawCampusUser) => {
    const campusUser = toRecord(rawCampusUser);
    return campusUser ? [campusUser] : [];
  });
  const campuses = toArray(root?.campus).flatMap((rawCampus) => {
    const campus = toRecord(rawCampus);
    return campus ? [campus] : [];
  });
  const primaryCampusUser =
    campusUsers.find((campusUser) => campusUser.is_primary === true || campusUser.primary === true) ??
    campusUsers[0];
  const primaryCampus = campuses[0];
  const cursusUsers = toArray(root?.cursus_users).flatMap((rawCursusUser) => {
    const cursusUser = toRecord(rawCursusUser);
    return cursusUser ? [cursusUser] : [];
  });
  const activeCursus =
    cursusUsers.find((cursusUser) => {
      const cursus = toRecord(cursusUser.cursus);
      const name = getCursusName(cursus);
      return !cursusUser.end_at && name === "42cursus";
    }) ??
    cursusUsers.find((cursusUser) => !cursusUser.end_at) ??
    null;
  const cursus = toRecord(activeCursus?.cursus);
  const beginDate = toOptionalIsoDate(activeCursus?.begin_at);
  const cohortStartDate = beginDate ? `${beginDate.slice(0, 7)}-01` : null;

  return {
    login: toOptionalString(root?.login) ?? login,
    campus: toOptionalString(primaryCampus?.name),
    campusId: toFiniteNumber(primaryCampusUser?.campus_id) ?? toFiniteNumber(primaryCampus?.id),
    cursus: getCursusName(cursus),
    cursusId: toFiniteNumber(activeCursus?.cursus_id) ?? toFiniteNumber(cursus?.id),
    grade: toOptionalString(activeCursus?.grade),
    level: toFiniteNumber(activeCursus?.level),
    cohortStartDate,
    cohortEndDate: cohortStartDate ? monthEndDate(cohortStartDate) : null,
    cohortLabel: formatCohortLabel(cohortStartDate),
  };
}

export function getFortyTwoCohortRank({
  rankAboveCount,
  rankPopulation,
  cohortLabel,
}: {
  rankAboveCount?: number | null;
  rankPopulation?: number | null;
  cohortLabel: string;
}): FortyTwoCohortRank {
  if (
    rankAboveCount === null ||
    rankAboveCount === undefined ||
    rankPopulation === null ||
    rankPopulation === undefined ||
    rankPopulation <= 0
  ) {
    return {
      rank: null,
      population: null,
      percentile: null,
      label: cohortLabel,
    };
  }

  const rank = Math.min(rankPopulation, Math.max(1, Math.floor(rankAboveCount) + 1));
  const percentile =
    rankPopulation <= 1 ? 100 : Math.round((1 - (rank - 1) / (rankPopulation - 1)) * 1000) / 10;

  return {
    rank,
    population: rankPopulation,
    percentile,
    label: cohortLabel,
  };
}

export function createEmptyFortyTwoDashboardStats(
  options: NormalizeOptions,
): PublicFortyTwoDashboardStats {
  return {
    login: options.login,
    campus: null,
    cursus: null,
    grade: null,
    level: null,
    todayLogtime: ZERO_TOTAL,
    last30Logtime: ZERO_TOTAL,
    activeDayAverage: ZERO_TOTAL,
    dailyLogtime: getDateRange(options.startDate, options.endDate).map((date) => ({
      date,
      ...ZERO_TOTAL,
    })),
    cohortRank: {
      rank: null,
      population: null,
      percentile: null,
      label: "common-core cohort",
    },
    levelProgression: [],
    rankProgression: [],
    fetchedAt: options.fetchedAt,
    unavailableReason: options.unavailableReason,
  };
}

export function normalizeFortyTwoDashboardStats({
  locationStatsPayload,
  userPayload,
  snapshots = [],
  ...options
}: NormalizeOptions & {
  locationStatsPayload: unknown;
  userPayload: unknown;
  snapshots?: FortyTwoDailySnapshot[];
}): PublicFortyTwoDashboardStats {
  const profile = extractFortyTwoProfile(userPayload, options.login);
  const locationStats = toRecord(locationStatsPayload);
  const dailyLogtime: FortyTwoDailyLogtime[] = getDateRange(options.startDate, options.endDate).map(
    (date) => ({
      date,
      ...makeTotal(parseFortyTwoLogtimeMinutes(locationStats?.[date])),
    }),
  );
  const totalMinutes = dailyLogtime.reduce((total, day) => total + day.totalMinutes, 0);
  const activeDays = dailyLogtime.filter((day) => day.totalMinutes > 0);
  const cohortRank = getFortyTwoCohortRank({
    rankAboveCount: options.rankAboveCount,
    rankPopulation: options.rankPopulation,
    cohortLabel: profile.cohortLabel,
  });
  const currentSnapshot = createFortyTwoDailySnapshot({
    date: options.endDate,
    todayLogtimeMinutes: dailyLogtime.at(-1)?.totalMinutes ?? 0,
    profile,
    cohortRank,
    fetchedAt: options.fetchedAt ?? new Date().toISOString(),
  });
  const publicSnapshots = normalizeFortyTwoSnapshots(
    snapshots.length ? snapshots : [currentSnapshot],
  );

  return {
    login: profile.login,
    campus: profile.campus,
    cursus: profile.cursus,
    grade: profile.grade,
    level: profile.level,
    todayLogtime: makeTotal(dailyLogtime.at(-1)?.totalMinutes ?? 0),
    last30Logtime: makeTotal(totalMinutes),
    activeDayAverage: makeTotal(
      activeDays.length === 0 ? 0 : totalMinutes / activeDays.length,
    ),
    dailyLogtime,
    cohortRank,
    levelProgression: getFortyTwoLevelProgression(publicSnapshots),
    rankProgression: getFortyTwoRankProgression(publicSnapshots),
    fetchedAt: options.fetchedAt,
    unavailableReason: options.unavailableReason,
  };
}

export function createFortyTwoDailySnapshot({
  date,
  todayLogtimeMinutes,
  profile,
  cohortRank,
  fetchedAt,
}: {
  date: string;
  todayLogtimeMinutes: number;
  profile: FortyTwoProfile;
  cohortRank: FortyTwoCohortRank;
  fetchedAt: string;
}): FortyTwoDailySnapshot {
  return {
    date,
    logtimeMinutes: Math.max(0, Math.round(todayLogtimeMinutes)),
    level: profile.level,
    rank: cohortRank.rank,
    cohortPopulation: cohortRank.population,
    cohortLabel: cohortRank.label,
    fetchedAt,
  };
}

export function normalizeFortyTwoSnapshots(
  snapshots: FortyTwoDailySnapshot[],
): FortyTwoDailySnapshot[] {
  return snapshots
    .filter((snapshot) => /^\d{4}-\d{2}-\d{2}$/.test(snapshot.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getFortyTwoLevelProgression(snapshots: FortyTwoDailySnapshot[]) {
  return normalizeFortyTwoSnapshots(snapshots)
    .filter((snapshot) => snapshot.level !== null)
    .map((snapshot) => ({
      date: snapshot.date,
      level: snapshot.level as number,
    }));
}

export function getFortyTwoRankProgression(snapshots: FortyTwoDailySnapshot[]) {
  return normalizeFortyTwoSnapshots(snapshots)
    .filter((snapshot) => snapshot.rank !== null && snapshot.cohortPopulation !== null)
    .map((snapshot) => {
      const rank = snapshot.rank as number;
      const population = snapshot.cohortPopulation as number;

      return {
        date: snapshot.date,
        rank,
        population,
        percentile:
          population <= 1 ? 100 : Math.round((1 - (rank - 1) / (population - 1)) * 1000) / 10,
      };
    });
}
