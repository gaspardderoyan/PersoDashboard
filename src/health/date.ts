export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function defaultDateForTimeZone(now: Date, timeZone: string): string {
  const yesterday = new Date(now.valueOf() - 24 * 60 * 60 * 1000);
  return dateForTimeZone(yesterday, timeZone);
}

export function currentDateForTimeZone(now: Date, timeZone: string): string {
  return dateForTimeZone(now, timeZone);
}

function dateForTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to format default date");
  }

  return `${year}-${month}-${day}`;
}

export function toCivilDateTime(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return {
    date: {
      year,
      month,
      day,
    },
    time: {
      hours: 0,
      minutes: 0,
      seconds: 0,
      nanos: 0,
    },
  };
}
