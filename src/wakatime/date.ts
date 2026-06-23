const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to format date");
  }

  return `${year}-${month}-${day}`;
}

export function addDays(date: string, days: number): string {
  if (!ISO_DATE_PATTERN.test(date)) {
    throw new Error("Invalid ISO date");
  }

  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function getDateRange(startDate: string, endDate: string): string[] {
  if (!ISO_DATE_PATTERN.test(startDate) || !ISO_DATE_PATTERN.test(endDate)) {
    throw new Error("Invalid ISO date range");
  }

  const dates: string[] = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}
