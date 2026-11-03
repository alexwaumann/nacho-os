import { getDueBadge } from "./dueDate";

/** "Nov 3, 2026" for a YYYY-MM-DD date; anything else (free text) as it is */
export function formatDueDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** "Due today", "Overdue (was due Nov 1, 2026)", "Due Nov 9, 2026"; null without a due date */
export function describeDueDate(dueDate: string | undefined, today: Date): string | null {
  if (!dueDate) return null;
  const badge = getDueBadge(dueDate, today);
  if (badge === "overdue") return `Overdue (was due ${formatDueDate(dueDate)})`;
  if (badge === "today") return "Due today";
  return `Due ${formatDueDate(dueDate)}`;
}
