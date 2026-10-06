import * as z from "zod";

import { applyVoiceOps, buildVoiceContext, getVoiceJobState, voiceOpSchema } from "./ops";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import type { AppliedVoiceOps, VoiceFollowUp, VoiceOp } from "./ops";

// The job-less voice agent: talks about all open jobs and today's route at once

type Job = Doc<"jobs">;
type JobId = Id<"jobs">;
export type GlobalJobStatus = Job["status"];
export type GlobalJobSheetTab = "tasks" | "info" | "money";

// Jobs are referenced by short refs ("j2") so the model never has to copy long ids
const jobRef = z.string().describe('Ref of a job from the list, e.g. "j2"');

// z.union (not discriminatedUnion) so the JSON schema uses anyOf, which Gemini supports
export const globalVoiceOpSchema = z.union([
  z.object({
    op: z.enum(["select_job"]),
    job: jobRef.describe("The job they're talking about, when no other op names it"),
  }),
  z.object({
    op: z.enum(["job_edit"]),
    job: jobRef,
    edit: voiceOpSchema.describe("One edit to that job; tasks by the job's task refs"),
  }),
  z.object({ op: z.enum(["add_to_route"]), job: jobRef }),
  z.object({ op: z.enum(["remove_from_route"]), job: jobRef }),
  z.object({ op: z.enum(["clear_route"]) }),
  z.object({
    op: z.enum(["set_route"]),
    jobs: z.array(jobRef).describe("Every stop for today, in driving order"),
  }),
  z.object({ op: z.enum(["optimize_route"]) }),
  z.object({
    op: z.enum(["set_job_status"]),
    job: jobRef,
    status: z.enum(["pending", "completed", "paid"]),
  }),
  z.object({
    op: z.enum(["open_job"]),
    job: jobRef,
    tab: z
      .enum(["tasks", "info", "money"])
      .optional()
      .describe("tasks: the checklist; info: address, codes, notes, files; money: costs and pay"),
  }),
  z.object({ op: z.enum(["answer"]) }),
]);

export type GlobalVoiceOp = z.infer<typeof globalVoiceOpSchema>;

export const globalVoiceResponseSchema = z.object({
  transcript: z.string().describe("Exactly what the user said"),
  ops: z.array(globalVoiceOpSchema).describe("What to do, in order; just [answer] for a question"),
  reply: z
    .string()
    .describe(
      "One short plain sentence: the answer, what changed (past tense), or a question. No markdown.",
    ),
});

export type GlobalVoiceResponse = z.infer<typeof globalVoiceResponseSchema>;

// --- Context sent to the model ---

/** One job as the model sees it. Empty fields are dropped when sent. */
export interface GlobalJobContext {
  ref: string;
  address: string;
  status: GlobalJobStatus;
  /** YYYY-MM-DD */
  due?: string;
  /** 1-based stop number on today's route */
  stop?: number;
  /** "2/5 done" */
  tasks?: string;
  /** "t1 Fix sink (done)" */
  taskList: Array<string>;
  codes: Array<string>;
  notes?: string;
}

export interface GlobalStopWeather {
  job: string;
  /** Estimated arrival, e.g. "10am" */
  arrive?: string;
  /** "2pm: rain likely, 71°" for the next hours */
  hours: Array<string>;
}

export interface GlobalVoiceContext {
  jobs: Array<GlobalJobContext>;
  /** Today's stops in driving order */
  route: Array<string>;
  /** The job the last exchange was about */
  focus?: string;
  weather?: { headline?: string; stops: Array<GlobalStopWeather> };
}

/** ref → job id, and per job its task ref → task id map (as built for the job agent). */
export interface GlobalRefs {
  jobs: Map<string, JobId>;
  tasks: Map<JobId, Map<string, string>>;
}

export interface StopWeatherInput {
  jobId: JobId;
  arrive?: string;
  hours: Array<string>;
}

export interface BuildGlobalContextInput {
  /** Open jobs (pending and completed-unpaid) plus anything else on the route */
  jobs: Array<Job>;
  /** Today's route, in order */
  route: Array<JobId>;
  focusJobId?: JobId | null;
  weather?: { headline?: string; stops: Array<StopWeatherInput> };
}

// Long notes are cut; the agent only needs enough to answer "what did I note about…"
const MAX_NOTES = 200;

export const shortAddress = (address: string) => address.split(",")[0].trim() || address;

/**
 * Builds the model's view of every open job. Refs follow creation order (oldest is j1), so a
 * job keeps its ref when the route is reordered or another job's status changes.
 */
export function buildGlobalContext({ jobs, route, focusJobId, weather }: BuildGlobalContextInput) {
  const sorted = [...jobs].sort((a, b) => a._creationTime - b._creationTime);
  const refs: GlobalRefs = { jobs: new Map(), tasks: new Map() };
  const refById = new Map<JobId, string>();

  const contextJobs = sorted.map((job, i): GlobalJobContext => {
    const ref = `j${i + 1}`;
    refs.jobs.set(ref, job._id);
    refById.set(job._id, ref);
    const { context, refs: taskRefs } = buildVoiceContext(job);
    refs.tasks.set(job._id, taskRefs);
    const doneCount = context.tasks.filter((task) => task.completed).length;
    const stop = route.indexOf(job._id);
    const notes = context.notes.trim();
    return {
      ref,
      address: job.address,
      status: job.status,
      due: job.dueDate,
      stop: stop === -1 ? undefined : stop + 1,
      tasks: context.tasks.length > 0 ? `${doneCount}/${context.tasks.length} done` : undefined,
      taskList: context.tasks.map(
        (task) => `${task.ref} ${task.taskName}${task.completed ? " (done)" : ""}`,
      ),
      codes: context.accessCodes,
      notes: notes.length > MAX_NOTES ? `${notes.slice(0, MAX_NOTES)}…` : notes || undefined,
    };
  });

  const context: GlobalVoiceContext = {
    jobs: contextJobs,
    route: route.flatMap((id) => refById.get(id) ?? []),
    focus: (focusJobId && refById.get(focusJobId)) || undefined,
    weather:
      weather && (weather.headline || weather.stops.length > 0) ?
        {
          headline: weather.headline,
          stops: weather.stops.flatMap(({ jobId, arrive, hours }) => {
            const job = refById.get(jobId);
            return job ? [{ job, arrive, hours }] : [];
          }),
        }
      : undefined,
  };

  return { context, refs };
}

// --- Weather summary ---

export interface ForecastHour {
  time: number;
  temp: number;
  precipProb: number;
  condition: string;
  isDay: boolean;
}

/** "2pm" in the device's time zone */
export function formatHour(time: number) {
  return new Date(time)
    .toLocaleTimeString("en-US", { hour: "numeric" })
    .replace(/\s/g, "")
    .toLowerCase();
}

/** One forecast hour condensed for the model, e.g. "2pm: rain likely, 71°". */
export function summarizeForecastHour(slot: ForecastHour) {
  const condition = slot.condition.toLowerCase();
  const kind =
    condition.includes("thunder") ? "storms"
    : condition.includes("snow") ? "snow"
    : "rain";
  const sky =
    slot.precipProb >= 60 ? `${kind} likely`
    : slot.precipProb >= 30 ? `${slot.precipProb}% chance of ${kind}`
    : condition === "sunny" && !slot.isDay ? "clear"
    : condition;
  return `${formatHour(slot.time)}: ${sky}, ${slot.temp}°`;
}

// --- Applying the model's ops ---

export interface GlobalState {
  jobs: Array<Job>;
  /** Today's route, in order */
  route: Array<JobId>;
}

export interface GlobalPlan {
  /** Set when the route's stops or their order change */
  route: { before: Array<JobId>; after: Array<JobId> } | null;
  /** Re-order the final route for the shortest drive */
  optimize: boolean;
  statuses: Array<{ jobId: JobId; from: GlobalJobStatus; to: GlobalJobStatus }>;
  /** Field edits per job, ready to save (status is never part of these) */
  edits: Array<{ jobId: JobId; applied: AppliedVoiceOps }>;
  open: { jobId: JobId; tab?: GlobalJobSheetTab } | null;
  /** The job this command was about, for the next recording's "it" and "there" */
  focusJobId: JobId | null;
  /** One plain-language line per change */
  summary: Array<string>;
  /** What couldn't be done, described for the user */
  skipped: Array<string>;
  /** Changes Undo can't fully take back */
  notUndoable: Array<string>;
}

const isSameOrder = (a: Array<JobId>, b: Array<JobId>) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Works out what the model's ops do to the jobs and today's route, without saving anything.
 * Pure, so it runs against the latest data on the client and can be unit tested.
 */
export function planGlobalOps(
  state: GlobalState,
  ops: Array<GlobalVoiceOp>,
  refs: GlobalRefs,
  newId?: () => string,
): GlobalPlan {
  const jobsById = new Map(state.jobs.map((job) => [job._id, job]));
  let route = [...state.route];
  let optimize = false;
  const statusById = new Map<JobId, GlobalJobStatus>();
  const editsById = new Map<JobId, Array<VoiceOp>>();
  let open: GlobalPlan["open"] = null;
  let focusJobId: JobId | null = null;
  const summary: Array<string> = [];
  const skipped: Array<string> = [];

  const findJob = (ref: string) => {
    const id = refs.jobs.get(ref.trim().toLowerCase());
    const job = id ? jobsById.get(id) : undefined;
    if (!job) skipped.push("Couldn't find that job");
    return job ?? null;
  };
  const label = (job: Job) => shortAddress(job.address);
  const statusOf = (job: Job) => statusById.get(job._id) ?? job.status;

  const setStatus = (job: Job, to: GlobalJobStatus) => {
    const from = statusOf(job);
    if (from === to) return;
    if (from === "paid") {
      skipped.push(`${label(job)} is already paid`);
      return;
    }
    statusById.set(job._id, to);
    summary.push(
      to === "paid" ? `Marked paid: ${label(job)}`
      : to === "completed" ? `Marked done: ${label(job)}`
      : `Reopened: ${label(job)}`,
    );
  };

  const canGoOnRoute = (job: Job) => {
    if (statusOf(job) === "pending") return true;
    skipped.push(`${label(job)} is already done, so it's not on the route`);
    return false;
  };

  for (const op of ops) {
    switch (op.op) {
      case "select_job":
      case "open_job": {
        const job = findJob(op.job);
        if (!job) break;
        focusJobId = job._id;
        if (op.op === "open_job") open = { jobId: job._id, tab: op.tab };
        break;
      }
      case "job_edit": {
        const job = findJob(op.job);
        if (!job) break;
        focusJobId = job._id;
        if (op.edit.op === "set_job_status") {
          setStatus(job, op.edit.status);
          break;
        }
        // Notes are cut short in the context, so a full rewrite could lose the rest
        if (op.edit.op === "set_notes") {
          skipped.push(`Open ${label(job)} to change its notes`);
          break;
        }
        editsById.set(job._id, [...(editsById.get(job._id) ?? []), op.edit]);
        break;
      }
      case "set_job_status": {
        const job = findJob(op.job);
        if (!job) break;
        focusJobId = job._id;
        setStatus(job, op.status);
        break;
      }
      case "add_to_route": {
        const job = findJob(op.job);
        if (!job) break;
        focusJobId = job._id;
        if (route.includes(job._id) || !canGoOnRoute(job)) break;
        route = [...route, job._id];
        summary.push(`Added to today's route: ${label(job)}`);
        break;
      }
      case "remove_from_route": {
        const job = findJob(op.job);
        if (!job) break;
        focusJobId = job._id;
        if (!route.includes(job._id)) {
          skipped.push(`${label(job)} wasn't on today's route`);
          break;
        }
        route = route.filter((id) => id !== job._id);
        summary.push(`Took off today's route: ${label(job)}`);
        break;
      }
      case "clear_route": {
        if (route.length === 0) break;
        route = [];
        summary.push("Cleared today's route");
        break;
      }
      case "set_route": {
        const next: Array<JobId> = [];
        for (const ref of op.jobs) {
          const job = findJob(ref);
          if (!job || next.includes(job._id) || !canGoOnRoute(job)) continue;
          next.push(job._id);
        }
        if (isSameOrder(next, route)) break;
        route = next;
        summary.push(
          next.length > 0 ?
            `Today's route: ${next.map((id) => label(jobsById.get(id)!)).join(" → ")}`
          : "Cleared today's route",
        );
        break;
      }
      case "optimize_route": {
        optimize = true;
        break;
      }
      case "answer":
        break;
    }
  }

  // Optimized last, so it covers stops added in the same breath
  if (optimize && route.length < 2) {
    optimize = false;
    skipped.push("Need at least two stops to find the best order");
  }
  if (optimize) summary.push("Put today's route in the best driving order");

  const edits = [...editsById].flatMap(([jobId, jobOps]) => {
    const job = jobsById.get(jobId)!;
    const applied = applyVoiceOps(
      getVoiceJobState(job),
      jobOps,
      refs.tasks.get(jobId) ?? new Map(),
      newId,
    );
    const prefix = (line: string) => `${label(job)}: ${line}`;
    summary.push(...applied.summary.map(prefix));
    skipped.push(...applied.skipped.map(prefix));
    return Object.keys(applied.changes).length > 0 ? [{ jobId, applied }] : [];
  });

  const statuses = [...statusById].flatMap(([jobId, to]) => {
    const from = jobsById.get(jobId)!.status;
    return from === to ? [] : [{ jobId, from, to }];
  });

  const notUndoable = statuses
    .filter((change) => change.to === "paid")
    .map((change) => `the paid date on ${label(jobsById.get(change.jobId)!)}`);

  return {
    route: isSameOrder(route, state.route) ? null : { before: [...state.route], after: route },
    optimize,
    statuses,
    edits,
    open,
    focusJobId,
    summary,
    skipped,
    notUndoable,
  };
}

/** The last exchange, sent along so the next recording can answer or correct it. */
export type GlobalFollowUp = VoiceFollowUp;

/**
 * The route writes that turn `before` into `after`: every stop selected with its new order,
 * and stops that were dropped deselected.
 */
export function buildRouteSelections(before: Array<JobId>, after: Array<JobId>) {
  return [
    ...after.map((jobId, routeOrder) => ({ jobId, selected: true, routeOrder })),
    ...before
      .filter((id) => !after.includes(id))
      .map((jobId) => ({ jobId, selected: false, routeOrder: undefined })),
  ];
}
