import { getStatusDates } from "../../convex/lib/jobStatus";
import type { Doc } from "../../convex/_generated/dataModel";

// Logic behind the job sheet (tasks, access codes, money, status), shared by the web and iOS apps

export type JobTask = NonNullable<Doc<"jobs">["tasks"]>[number];
export type JobStatus = Doc<"jobs">["status"];

export interface TaskGroup {
  category: string;
  tasks: Array<JobTask>;
  done: number;
}

const OTHER_CATEGORY = "Other";

/**
 * Tasks grouped by category, in the order each category first appears on the work order.
 * Tasks keep their order inside a group. Blank categories go under "Other".
 */
export function groupTasksByCategory(tasks: ReadonlyArray<JobTask> | undefined): Array<TaskGroup> {
  const groups = new Map<string, TaskGroup>();
  for (const task of tasks ?? []) {
    const category = task.category.trim() || OTHER_CATEGORY;
    const group = groups.get(category) ?? { category, tasks: [], done: 0 };
    group.tasks.push(task);
    if (task.completed) group.done += 1;
    groups.set(category, group);
  }
  return [...groups.values()];
}

/** How many of the job's tasks are done, out of how many */
export function getTaskProgress(tasks: ReadonlyArray<JobTask> | undefined) {
  const total = tasks?.length ?? 0;
  const done = tasks?.filter((task) => task.completed).length ?? 0;
  return { done, total, fraction: total > 0 ? done / total : 0 };
}

/** Whether checking off `taskId` finishes the job's last open task */
export function isLastOpenTask(tasks: ReadonlyArray<JobTask> | undefined, taskId: string) {
  if (!tasks?.some((task) => task.id === taskId && !task.completed)) return false;
  return tasks.every((task) => task.completed || task.id === taskId);
}

/** The job's tasks with one task checked or unchecked (for an optimistic update) */
export function setTaskCompleted<T extends JobTask>(
  tasks: ReadonlyArray<T> | undefined,
  taskId: string,
  completed: boolean,
): Array<T> | undefined {
  return tasks?.map((task) => (task.id === taskId ? { ...task, completed } : task));
}

/** "2 gal", "3", or null when the task has no quantity */
export function formatTaskQuantity(task: Pick<JobTask, "quantity" | "unit">): string | null {
  if (task.quantity === undefined) return null;
  return task.unit ? `${task.quantity} ${task.unit}` : String(task.quantity);
}

/** "Lockbox: 7731" → label "Lockbox", code "7731"; anything else is shown whole as the code */
export function splitAccessCode(code: string): { label: string | null; value: string } {
  const match = /^([^:]+):\s*(.+)$/.exec(code);
  return match ? { label: match[1].trim(), value: match[2].trim() } : { label: null, value: code };
}

/** The codes with one added at the end; blank codes are ignored */
export function addAccessCode(codes: ReadonlyArray<string>, code: string): Array<string> {
  const trimmed = code.trim();
  return trimmed ? [...codes, trimmed] : [...codes];
}

/** Put a removed code back where it was (for Undo), even if the list changed since */
export function restoreAccessCode(
  codes: ReadonlyArray<string>,
  index: number,
  code: string,
): Array<string> {
  const at = Math.min(Math.max(index, 0), codes.length);
  return [...codes.slice(0, at), code, ...codes.slice(at)];
}

/** $84.10 */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

/**
 * What the job brought in: the check (if scanned), what the receipts add up to, and what's
 * left after the receipts (only once there's a check). Rounded to cents so float sums don't
 * show as $0.30000000004.
 */
export function getJobMoneySummary(
  receipts: ReadonlyArray<{ total: number }> | undefined,
  payment: { amount: number } | null | undefined,
) {
  const spent = roundToCents((receipts ?? []).reduce((sum, receipt) => sum + receipt.total, 0));
  const paid = payment ? roundToCents(payment.amount) : null;
  return {
    spent,
    receiptCount: receipts?.length ?? 0,
    paid,
    leftAfterReceipts: paid === null ? null : roundToCents(paid - spent),
  };
}

function roundToCents(amount: number) {
  return Math.round(amount * 100) / 100;
}

/**
 * The job after a status change, as the server will save it (convex/jobs.ts updateStatus, dates
 * from getStatusDates in convex/lib/jobStatus.ts). For optimistic updates.
 */
export function applyStatusChange<T extends Pick<Doc<"jobs">, "status" | "completedOn" | "paidOn">>(
  job: T,
  status: JobStatus,
  todayIso: string,
): T {
  return { ...job, status, ...getStatusDates(job, status, todayIso) };
}

/** Which status changes the job sheet offers, in the order to show them */
export function getStatusActions(status: JobStatus): Array<JobStatus> {
  if (status === "pending") return ["completed"];
  if (status === "completed") return ["paid", "pending"];
  return ["pending"];
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Not done yet",
  completed: "Done, not paid",
  paid: "Paid",
};
