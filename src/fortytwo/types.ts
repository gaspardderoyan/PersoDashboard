export type Env = Record<string, string | undefined>;

export type FortyTwoTotal = {
  totalMinutes: number;
  text: string;
};

export type FortyTwoDailyLogtime = FortyTwoTotal & {
  date: string;
};

export type FortyTwoLevelPoint = {
  date: string;
  level: number;
};

export type FortyTwoRankPoint = {
  date: string;
  rank: number;
  population: number;
  percentile: number;
};

export type FortyTwoDailySnapshot = {
  date: string;
  logtimeMinutes: number;
  level: number | null;
  rank: number | null;
  cohortPopulation: number | null;
  cohortLabel: string | null;
  fetchedAt: string;
};

export type FortyTwoCohortRank = {
  rank: number | null;
  population: number | null;
  percentile: number | null;
  label: string;
};

export type PublicFortyTwoDashboardStats = {
  login: string;
  campus: string | null;
  cursus: string | null;
  grade: string | null;
  level: number | null;
  todayLogtime: FortyTwoTotal;
  last30Logtime: FortyTwoTotal;
  activeDayAverage: FortyTwoTotal;
  dailyLogtime: FortyTwoDailyLogtime[];
  cohortRank: FortyTwoCohortRank;
  levelProgression: FortyTwoLevelPoint[];
  rankProgression: FortyTwoRankPoint[];
  fetchedAt: string | null;
  unavailableReason?: string;
};

export type FortyTwoFetch = (
  input: string | URL,
  init?: RequestInit & {
    next?: {
      revalidate?: number | false;
    };
  },
) => Promise<Response>;

