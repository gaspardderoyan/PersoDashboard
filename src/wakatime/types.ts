export type Env = Record<string, string | undefined>;

export type WakaTimeTotal = {
  totalSeconds: number;
  text: string;
};

export type WakaTimeDailyTotal = WakaTimeTotal & {
  date: string;
};

export type WakaTimeBreakdownItem = WakaTimeTotal & {
  name: string;
  percent: number;
  color: string | null;
};

export type PublicWakaTimeCodingStats = {
  todayTotal: WakaTimeTotal;
  last7Total: WakaTimeTotal;
  activeDayAverage: WakaTimeTotal;
  dailyTotals: WakaTimeDailyTotal[];
  topLanguages: WakaTimeBreakdownItem[];
  topEditors: WakaTimeBreakdownItem[];
  fetchedAt: string | null;
  unavailableReason?: string;
};

export type WakaTimeFetch = (
  input: string | URL,
  init?: RequestInit & {
    next?: {
      revalidate?: number | false;
    };
  },
) => Promise<Response>;
