export type Env = Record<string, string | undefined>;

export type RescueTimeTotal = {
  totalSeconds: number;
  text: string;
};

export type PublicRescueTimeComputerStats = {
  date: string;
  total: RescueTimeTotal;
  productive: RescueTimeTotal;
  neutral: RescueTimeTotal;
  distracting: RescueTimeTotal;
  fetchedAt: string | null;
  unavailableReason?: string;
};

export type RescueTimeFetch = (
  input: string | URL,
  init?: RequestInit & {
    next?: {
      revalidate?: number | false;
    };
  },
) => Promise<Response>;
