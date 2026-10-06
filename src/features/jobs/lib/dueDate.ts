// Due dates are stored as YYYY-MM-DD; older manual entries can be free text
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type DueBadge = "overdue" | "today";

/** The calendar date of `date` in local time, as YYYY-MM-DD. */
export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Which due badge a job should show: "overdue" when the due date is before today,
 * "today" when it is today, otherwise null (also for missing or free-text dates).
 */
export function getDueBadge(dueDate: string | undefined, today: Date): DueBadge | null {
  if (!dueDate || !ISO_DATE.test(dueDate)) return null;
  const todayIso = toLocalIsoDate(today);
  if (dueDate < todayIso) return "overdue";
  if (dueDate === todayIso) return "today";
  return null;
}

// 0 = real date, 1 = free-text date we can't compare, 2 = no due date
function dueDateRank(dueDate: string | undefined): number {
  if (!dueDate) return 2;
  return ISO_DATE.test(dueDate) ? 0 : 1;
}

/**
 * Returns a new array sorted by due date, soonest first. Jobs with a free-text date come
 * after dated ones, and jobs without a due date come last. Ties keep their original order.
 */
export function sortJobsByDueDate<T extends { dueDate?: string }>(
  jobs: ReadonlyArray<T>,
): Array<T> {
  return [...jobs].sort((a, b) => {
    const rankA = dueDateRank(a.dueDate);
    const rankB = dueDateRank(b.dueDate);
    if (rankA !== rankB) return rankA - rankB;
    if (rankA !== 0) return 0;
    return a.dueDate!.localeCompare(b.dueDate!);
  });
}
