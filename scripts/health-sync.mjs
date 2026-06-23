import { readFileSync } from "node:fs";

const DEFAULT_BASE_URL = "https://perso-dashboard-roan.vercel.app";
const DEFAULT_TIME_ZONE = "Europe/Paris";

function loadEnvFile(path = ".env.local") {
  try {
    const env = {};
    const lines = readFileSync(path, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match) {
        continue;
      }

      const [, key, rawValue] = match;
      env[key] = rawValue.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }

    return env;
  } catch {
    return {};
  }
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function addDays(date, days) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function currentDateForTimeZone(now, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to format date");
  }

  return `${year}-${month}-${day}`;
}

function dateRange(startDate, endDate) {
  const dates = [];
  let currentDate = startDate;

  while (currentDate <= endDate) {
    dates.push(currentDate);
    currentDate = addDays(currentDate, 1);
  }

  return dates;
}

function usage() {
  console.error(`Usage:
  npm run health:sync -- YYYY-MM-DD
  npm run health:sync:today
  npm run health:backfill -- YYYY-MM-DD YYYY-MM-DD

Optional env:
  HEALTH_SYNC_BASE_URL=${DEFAULT_BASE_URL}`);
}

async function syncDate({ baseUrl, cronSecret, date }) {
  const url = new URL("/api/health/cron", baseUrl);
  url.searchParams.set("date", date);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${date} failed with ${response.status}: ${body}`);
  }

  return JSON.parse(body);
}

const env = {
  ...loadEnvFile(),
  ...process.env,
};

const command = process.argv[2];
const baseUrl = env.HEALTH_SYNC_BASE_URL ?? DEFAULT_BASE_URL;
const cronSecret = env.CRON_SECRET;

if (!cronSecret) {
  console.error("Missing CRON_SECRET. Add it to .env.local or export it in your shell.");
  process.exit(1);
}

let dates;

if (command === "sync") {
  const date = process.argv[3];
  if (!date || !isIsoDate(date)) {
    usage();
    process.exit(1);
  }
  dates = [date];
} else if (command === "today") {
  dates = [currentDateForTimeZone(new Date(), env.GOOGLE_HEALTH_TIME_ZONE ?? DEFAULT_TIME_ZONE)];
} else if (command === "backfill") {
  const startDate = process.argv[3];
  const endDate =
    process.argv[4] ?? currentDateForTimeZone(new Date(), env.GOOGLE_HEALTH_TIME_ZONE ?? DEFAULT_TIME_ZONE);

  if (!startDate || !isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate) {
    usage();
    process.exit(1);
  }

  dates = dateRange(startDate, endDate);
} else {
  usage();
  process.exit(1);
}

console.log(`Syncing ${dates.length} day(s) to ${baseUrl}`);

for (const date of dates) {
  const result = await syncDate({ baseUrl, cronSecret, date });
  const records = result.records?.map((record) => record.date).join(", ") ?? date;
  console.log(`ok ${records}`);
}
