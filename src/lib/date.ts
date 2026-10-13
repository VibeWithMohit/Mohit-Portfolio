const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Parse `YYYY-MM-DD` as a local calendar date, avoiding UTC day shifts. */
export function parseDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`Invalid ISO date: ${iso}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Whole calendar months elapsed between two dates, aware of the day of month. */
export function monthsBetween(start: Date, end: Date): number {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

/** `29` → `2 yrs 5 mos`; `12` → `1 yr`; `0` → `0 mos`. */
export function formatDuration(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yr${years === 1 ? '' : 's'}`);
  if (months > 0 || years === 0) parts.push(`${months} mo${months === 1 ? '' : 's'}`);
  return parts.join(' ');
}

export function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDayMonthYear(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Fractional year (2024.3 ≈ mid-April 2024) for placing dates on a timeline. */
export function toFractionalYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1).getTime();
  const end = new Date(date.getFullYear() + 1, 0, 1).getTime();
  return date.getFullYear() + (date.getTime() - start) / (end - start);
}

/** The day this build was produced — a deterministic "now" for prerendering. */
export function buildDate(): Date {
  return parseDate(__BUILD_DATE__);
}
