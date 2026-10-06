import * as z from "zod";

import type { Doc } from "../../../../convex/_generated/dataModel";

type Task = NonNullable<Doc<"jobs">["tasks"]>[number];
type JobStatus = "pending" | "completed";

// Tasks are referenced by short refs ("t3") so the model never has to copy long ids
const taskRef = z.string().describe('Ref of an existing task from the job, e.g. "t3"');
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("YYYY-MM-DD");

const taskFields = {
  taskName: z.string().describe('Short imperative name, e.g. "Replace kitchen faucet cartridge"'),
  category: z
    .string()
    .describe('Trade category, e.g. "Plumbing"; reuse an existing one if it fits'),
  area: z.string().describe('Room or location, e.g. "Master bath"'),
  specificInstructions: z.string().describe("Extra details: sizes, colors, brands, how-to"),
  quantity: z.number(),
  unit: z.string(),
  materials: z.array(z.string()).describe("Full list of materials to buy or bring"),
  tools: z.array(z.string()).describe("Full list of tools needed"),
  requiresOnlineOrder: z.boolean().describe("True when something must be ordered online"),
};

// z.union (not discriminatedUnion) so the JSON schema uses anyOf, which Gemini supports
export const voiceOpSchema = z.union([
  z.object({
    op: z.enum(["add_task"]),
    ...taskFields,
    category: taskFields.category.optional(),
    area: taskFields.area.optional(),
    specificInstructions: taskFields.specificInstructions.optional(),
    quantity: taskFields.quantity.optional(),
    unit: taskFields.unit.optional(),
    materials: taskFields.materials.optional(),
    tools: taskFields.tools.optional(),
    requiresOnlineOrder: taskFields.requiresOnlineOrder.optional(),
    position: z.number().optional().describe("1-based position; omit to add at the end"),
  }),
  z.object({
    op: z.enum(["update_task"]),
    task: taskRef,
    completed: z.boolean().optional(),
    taskName: taskFields.taskName.optional(),
    category: taskFields.category.optional(),
    area: taskFields.area.optional(),
    specificInstructions: taskFields.specificInstructions.optional(),
    quantity: taskFields.quantity.optional(),
    unit: taskFields.unit.optional(),
    materials: taskFields.materials.optional(),
    tools: taskFields.tools.optional(),
    requiresOnlineOrder: taskFields.requiresOnlineOrder.optional(),
  }),
  z.object({ op: z.enum(["remove_task"]), task: taskRef }),
  z.object({
    op: z.enum(["move_task"]),
    task: taskRef,
    position: z.number().describe("New 1-based position in the task list"),
  }),
  z.object({
    op: z.enum(["add_access_code"]),
    code: z.string().describe('Formatted like the existing codes, e.g. "Lockbox: 4521"'),
  }),
  z.object({
    op: z.enum(["remove_access_code"]),
    code: z.string().describe("The exact existing code string to remove"),
  }),
  z.object({
    op: z.enum(["append_notes"]),
    text: z.string().describe("New note text to add after the existing notes"),
  }),
  z.object({
    op: z.enum(["set_notes"]),
    notes: z.string().describe("The complete new notes text, replacing the existing notes"),
  }),
  z.object({ op: z.enum(["set_due_date"]), date: isoDate }),
  z.object({ op: z.enum(["clear_due_date"]) }),
  z.object({ op: z.enum(["set_job_status"]), status: z.enum(["pending", "completed"]) }),
]);

export type VoiceOp = z.infer<typeof voiceOpSchema>;

export const voiceResponseSchema = z.object({
  transcript: z.string().describe("Exactly what the user said"),
  ops: z.array(voiceOpSchema).describe("Edits to apply, in order; empty if nothing to change"),
  reply: z
    .string()
    .describe(
      "One short plain sentence: what changed (past tense), or a question if unclear. No markdown.",
    ),
});

export type VoiceResponse = z.infer<typeof voiceResponseSchema>;

/** The parts of a job a voice command can change. */
export interface VoiceJobState {
  tasks: Array<Task>;
  accessCodes: Array<string>;
  notes: string;
  dueDate: string | null;
  status: JobStatus | "paid";
}

/** What the model sees: the job with tasks keyed by short refs. */
export interface VoiceJobContext {
  address: string;
  summary?: string;
  status: VoiceJobState["status"];
  dueDate: string | null;
  accessCodes: Array<string>;
  notes: string;
  tasks: Array<Omit<Task, "id" | "page"> & { ref: string }>;
}

export function getVoiceJobState(job: Doc<"jobs">): VoiceJobState {
  return {
    tasks: job.tasks ?? [],
    accessCodes: job.accessCodes ?? [],
    notes: job.notes ?? "",
    dueDate: job.dueDate ?? null,
    status: job.status,
  };
}

/** Builds the model's view of the job plus the ref → task id map used to apply its ops. */
export function buildVoiceContext(job: Doc<"jobs">) {
  const state = getVoiceJobState(job);
  const refs = new Map<string, string>();
  const context: VoiceJobContext = {
    address: job.address,
    summary: job.summary,
    status: state.status,
    dueDate: state.dueDate,
    accessCodes: state.accessCodes,
    notes: state.notes,
    tasks: state.tasks.map(({ id, page: _page, ...task }, i) => {
      const ref = `t${i + 1}`;
      refs.set(ref, id);
      return { ref, ...task };
    }),
  };
  return { context, refs };
}

export interface AppliedVoiceOps {
  /** Only the fields that changed, with their new values. */
  changes: Partial<VoiceJobState>;
  /** The same fields' values before the change, for undo. */
  previous: Partial<VoiceJobState>;
  /** One plain-language line per applied op. */
  summary: Array<string>;
  /** Ops that couldn't be applied (unknown task, missing code), described for the user. */
  skipped: Array<string>;
}

const normalizeCode = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, "");

function clampPosition(position: number | undefined, length: number) {
  if (position === undefined) return length;
  return Math.min(Math.max(Math.round(position) - 1, 0), length);
}

function formatDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Applies the model's ops to a job's current state. Pure, so it can run against the latest
 * job on the client and be unit tested. Task refs resolve through `refs` (built when the
 * request was sent), so tasks reordered or edited in the meantime still match by id.
 */
export function applyVoiceOps(
  state: VoiceJobState,
  ops: Array<VoiceOp>,
  refs: Map<string, string>,
  newId: () => string = () => `task-voice-${crypto.randomUUID()}`,
): AppliedVoiceOps {
  let tasks = [...state.tasks];
  let accessCodes = [...state.accessCodes];
  let notes = state.notes;
  let dueDate = state.dueDate;
  let status = state.status;
  const summary: Array<string> = [];
  const skipped: Array<string> = [];

  const findTask = (ref: string) => {
    const id = refs.get(ref);
    const index = tasks.findIndex((t) => t.id === id);
    return index === -1 ? null : { index, task: tasks[index] };
  };

  for (const op of ops) {
    switch (op.op) {
      case "add_task": {
        const { op: _op, position, ...fields } = op;
        const task: Task = {
          ...fields,
          id: newId(),
          category: fields.category ?? "General",
          requiresOnlineOrder: fields.requiresOnlineOrder ?? false,
          completed: false,
        };
        tasks.splice(clampPosition(position, tasks.length), 0, task);
        summary.push(`Added task: ${task.taskName}`);
        break;
      }
      case "update_task": {
        const found = findTask(op.task);
        if (!found) {
          skipped.push(`Couldn't find task ${op.task}`);
          break;
        }
        const { op: _op, task: _ref, ...fields } = op;
        const updated = { ...found.task, ...fields };
        tasks[found.index] = updated;
        const { completed, ...edits } = fields;
        if (completed !== undefined && completed !== found.task.completed) {
          summary.push(`${completed ? "Done" : "Not done"}: ${updated.taskName}`);
        }
        // The model sometimes repeats unchanged fields; only report real edits
        const isEdited = Object.entries(edits).some(
          ([key, value]) => JSON.stringify(value) !== JSON.stringify(found.task[key as keyof Task]),
        );
        if (isEdited) {
          summary.push(`Updated task: ${updated.taskName}`);
        }
        break;
      }
      case "remove_task": {
        const found = findTask(op.task);
        if (!found) {
          skipped.push(`Couldn't find task ${op.task}`);
          break;
        }
        tasks = tasks.filter((_, i) => i !== found.index);
        summary.push(`Removed task: ${found.task.taskName}`);
        break;
      }
      case "move_task": {
        const found = findTask(op.task);
        if (!found) {
          skipped.push(`Couldn't find task ${op.task}`);
          break;
        }
        tasks.splice(found.index, 1);
        const to = clampPosition(op.position, tasks.length);
        tasks.splice(to, 0, found.task);
        summary.push(`Moved to #${to + 1}: ${found.task.taskName}`);
        break;
      }
      case "add_access_code": {
        const code = op.code.trim();
        if (!code || accessCodes.some((c) => normalizeCode(c) === normalizeCode(code))) break;
        accessCodes = [...accessCodes, code];
        summary.push(`Added code: ${code}`);
        break;
      }
      case "remove_access_code": {
        const target = normalizeCode(op.code);
        const index = accessCodes.findIndex((c) => normalizeCode(c) === target);
        if (index === -1) {
          skipped.push(`Couldn't find code ${op.code}`);
          break;
        }
        summary.push(`Removed code: ${accessCodes[index]}`);
        accessCodes = accessCodes.filter((_, i) => i !== index);
        break;
      }
      case "append_notes": {
        const text = op.text.trim();
        if (!text) break;
        notes = notes.trim() ? `${notes.trimEnd()}\n${text}` : text;
        summary.push(`Added note: ${text}`);
        break;
      }
      case "set_notes": {
        notes = op.notes.trim();
        summary.push(notes ? "Rewrote job notes" : "Cleared job notes");
        break;
      }
      case "set_due_date": {
        if (op.date === dueDate) break;
        dueDate = op.date;
        summary.push(`Due date: ${formatDate(op.date)}`);
        break;
      }
      case "clear_due_date": {
        if (dueDate === null) break;
        dueDate = null;
        summary.push("Removed due date");
        break;
      }
      case "set_job_status": {
        // Paid jobs are settled; voice can't reopen or re-complete them
        if (status === "paid" || op.status === status) break;
        status = op.status;
        summary.push(op.status === "completed" ? "Marked job complete" : "Reopened job");
        break;
      }
    }
  }

  const next: VoiceJobState = { tasks, accessCodes, notes, dueDate, status };
  const changes: Partial<VoiceJobState> = {};
  const previous: Partial<VoiceJobState> = {};
  for (const key of Object.keys(next) as Array<keyof VoiceJobState>) {
    if (JSON.stringify(next[key]) !== JSON.stringify(state[key])) {
      Object.assign(changes, { [key]: next[key] });
      Object.assign(previous, { [key]: state[key] });
    }
  }

  return { changes, previous, summary, skipped };
}
