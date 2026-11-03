// Calendar math for picking a date without a native date picker. Dates are local calendar days
// as YYYY-MM-DD (how due dates are stored).

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The local date for a YYYY-MM-DD string, or null if it isn't one */
export function parseIsoDate(value: string | undefined): Date | null {
  const match = value ? ISO_DATE.exec(value) : null;
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  // Reject dates like 2026-02-31 that roll over into the next month
  return date.getDate() === Number(match[3]) ? date : null;
}

/** The calendar date of `date` in local time, as YYYY-MM-DD */
export function toIsoDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The YYYY-MM-DD date `days` days after `date` (negative goes back) */
export function addDays(date: Date, days: number): string {
  return toIsoDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

/**
 * "Nov 3, 2026" for a YYYY-MM-DD date; free text (older manual due dates) is returned as is.
 */
export function formatIsoDate(value: string, locale?: string): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  return date.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * The days of a month laid out in weeks (Sunday first), as YYYY-MM-DD, with null for the blank
 * cells before the 1st and after the last day. `month` is 0-based like Date.
 */
export function getMonthGrid(year: number, month: number): Array<Array<string | null>> {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<string | null> = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toIsoDay(new Date(year, month, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** The month before or after (`delta` months away), as a 0-based month and its year */
export function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}
