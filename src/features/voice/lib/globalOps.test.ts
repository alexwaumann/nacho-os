import { describe, expect, it } from "vitest";

import { omitEmpty } from "./agent";
import {
  buildGlobalContext,
  buildRouteSelections,
  globalVoiceResponseSchema,
  planGlobalOps,
  summarizeForecastHour,
} from "./globalOps";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import type { GlobalState, GlobalVoiceOp } from "./globalOps";

const task = (id: string, taskName: string, completed = false) => ({
  id,
  taskName,
  category: "General",
  requiresOnlineOrder: false,
  completed,
});

const makeJob = (
  id: string,
  creationTime: number,
  address: string,
  extra: Partial<Doc<"jobs">> = {},
) =>
  ({
    _id: id,
    _creationTime: creationTime,
    address,
    status: "pending",
    selectedForRoute: false,
    tasks: [],
    ...extra,
  }) as unknown as Doc<"jobs">;

const id = (value: string) => value as Id<"jobs">;

// Listed newest first, like api.jobs.listUnpaid
const jobs = [
  makeJob("elm", 300, "22 Elm St, Lufkin, TX 75901", { selectedForRoute: true, routeOrder: 0 }),
  makeJob("done", 250, "9 Pine Rd, Nacogdoches, TX", { status: "completed" }),
  makeJob("oak", 200, "1418 Oak St, Austin, TX 78704", {
    selectedForRoute: true,
    routeOrder: 1,
    dueDate: "2026-10-09",
    notes: "Dog in the yard.",
    accessCodes: ["Gate: 1234"],
    tasks: [task("a", "Fix sink", true), task("b", "Paint trim")],
  }),
  makeJob("main", 100, "5 Main St, Lufkin, TX 75904"),
];
const route = [id("elm"), id("oak")];
const state: GlobalState = { jobs, route };
const { context, refs } = buildGlobalContext({ jobs, route });
const plan = (ops: Array<GlobalVoiceOp>, from = state) =>
  planGlobalOps(from, ops, refs, () => "new");

describe("buildGlobalContext", () => {
  it("numbers jobs by creation order so refs don't move when the route or list order changes", () => {
    expect(context.jobs.map((job) => [job.ref, job.address.split(" ")[1]])).toEqual([
      ["j1", "Main"],
      ["j2", "Oak"],
      ["j3", "Pine"],
      ["j4", "Elm"],
    ]);
    const reordered = buildGlobalContext({
      jobs: [...jobs].reverse(),
      route: [...route].reverse(),
    });
    expect([...reordered.refs.jobs]).toEqual([...refs.jobs]);
  });

  it("lists the route by ref and gives each stop its number", () => {
    expect(context.route).toEqual(["j4", "j2"]);
    expect(context.jobs.find((job) => job.ref === "j2")?.stop).toBe(2);
    expect(context.jobs.find((job) => job.ref === "j1")?.stop).toBeUndefined();
  });

  it("keeps a job compact: task count, task refs, codes and notes", () => {
    expect(context.jobs.find((job) => job.ref === "j2")).toEqual({
      ref: "j2",
      address: "1418 Oak St, Austin, TX 78704",
      status: "pending",
      due: "2026-10-09",
      stop: 2,
      tasks: "1/2 done",
      taskList: ["t1 Fix sink (done)", "t2 Paint trim"],
      codes: ["Gate: 1234"],
      notes: "Dog in the yard.",
    });
    expect(refs.tasks.get(id("oak"))?.get("t2")).toBe("b");
  });

  it("drops empty fields when sent", () => {
    expect(JSON.parse(JSON.stringify(context.jobs[0], omitEmpty))).toEqual({
      ref: "j1",
      address: "5 Main St, Lufkin, TX 75904",
      status: "pending",
    });
  });

  it("carries the focus job and per-stop weather by ref", () => {
    const built = buildGlobalContext({
      jobs,
      route,
      focusJobId: id("oak"),
      weather: {
        headline: "Rain after lunch",
        stops: [{ jobId: id("elm"), arrive: "9am", hours: ["9am: sunny, 70°"] }],
      },
    });
    expect(built.context.focus).toBe("j2");
    expect(built.context.weather).toEqual({
      headline: "Rain after lunch",
      stops: [{ job: "j4", arrive: "9am", hours: ["9am: sunny, 70°"] }],
    });
  });
});

describe("summarizeForecastHour", () => {
  const at2pm = new Date(2026, 9, 6, 14).getTime();
  it("says rain is likely above 60%", () => {
    expect(
      summarizeForecastHour({
        time: at2pm,
        temp: 71,
        precipProb: 70,
        condition: "Rainy",
        isDay: true,
      }),
    ).toBe("2pm: rain likely, 71°");
  });
  it("gives the chance for a maybe, and the sky otherwise", () => {
    const slot = { time: at2pm, temp: 65, condition: "Cloudy", isDay: true };
    expect(summarizeForecastHour({ ...slot, precipProb: 40 })).toBe("2pm: 40% chance of rain, 65°");
    expect(summarizeForecastHour({ ...slot, precipProb: 10 })).toBe("2pm: cloudy, 65°");
  });
});

describe("planGlobalOps: route", () => {
  it("adds a stop at the end", () => {
    const result = plan([{ op: "add_to_route", job: "j1" }]);
    expect(result.route).toEqual({ before: route, after: [id("elm"), id("oak"), id("main")] });
    expect(result.summary).toEqual(["Added to today's route: 5 Main St"]);
    expect(result.focusJobId).toBe("main");
  });

  it("won't put a finished job on the route", () => {
    const result = plan([{ op: "add_to_route", job: "j3" }]);
    expect(result.route).toBeNull();
    expect(result.skipped).toEqual(["9 Pine Rd is already done, so it's not on the route"]);
  });

  it("takes a stop off, and says so when it wasn't on", () => {
    expect(plan([{ op: "remove_from_route", job: "J2" }]).route?.after).toEqual([id("elm")]);
    expect(plan([{ op: "remove_from_route", job: "j1" }]).skipped).toEqual([
      "5 Main St wasn't on today's route",
    ]);
  });

  it("clears the route", () => {
    const result = plan([{ op: "clear_route" }]);
    expect(result.route?.after).toEqual([]);
    expect(result.summary).toEqual(["Cleared today's route"]);
  });

  it("replaces the route in the order given, ignoring repeats and unknown jobs", () => {
    const result = plan([{ op: "set_route", jobs: ["j2", "j1", "j2", "j9", "j4"] }]);
    expect(result.route?.after).toEqual([id("oak"), id("main"), id("elm")]);
    expect(result.summary).toEqual(["Today's route: 1418 Oak St → 5 Main St → 22 Elm St"]);
    expect(result.skipped).toEqual(["Couldn't find that job"]);
  });

  it("leaves the route alone when set_route repeats it", () => {
    expect(plan([{ op: "set_route", jobs: ["j4", "j2"] }]).route).toBeNull();
  });

  it("optimizes after the other route changes, and needs two stops", () => {
    const result = plan([{ op: "optimize_route" }, { op: "add_to_route", job: "j1" }]);
    expect(result.optimize).toBe(true);
    expect(result.summary.at(-1)).toBe("Put today's route in the best driving order");

    const single = plan([{ op: "remove_from_route", job: "j2" }, { op: "optimize_route" }]);
    expect(single.optimize).toBe(false);
    expect(single.skipped).toEqual(["Need at least two stops to find the best order"]);
  });

  it("builds the writes for a new route: selected in order, dropped stops deselected", () => {
    expect(buildRouteSelections([id("elm"), id("oak")], [id("oak"), id("main")])).toEqual([
      { jobId: "oak", selected: true, routeOrder: 0 },
      { jobId: "main", selected: true, routeOrder: 1 },
      { jobId: "elm", selected: false, routeOrder: undefined },
    ]);
  });
});

describe("planGlobalOps: jobs", () => {
  it("changes status, and a job finished in the same breath can't be added to the route", () => {
    const result = plan([
      { op: "set_job_status", job: "j1", status: "completed" },
      { op: "add_to_route", job: "j1" },
    ]);
    expect(result.statuses).toEqual([{ jobId: "main", from: "pending", to: "completed" }]);
    expect(result.route).toBeNull();
  });

  it("marks paid and notes that the paid date stays on undo", () => {
    const result = plan([{ op: "set_job_status", job: "j3", status: "paid" }]);
    expect(result.summary).toEqual(["Marked paid: 9 Pine Rd"]);
    expect(result.notUndoable).toEqual(["the paid date on 9 Pine Rd"]);
  });

  it("applies job edits with that job's task refs, labelled by street", () => {
    const result = plan([
      { op: "job_edit", job: "j2", edit: { op: "update_task", task: "t2", completed: true } },
      { op: "job_edit", job: "j2", edit: { op: "append_notes", text: "Bring a ladder." } },
    ]);
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0].jobId).toBe("oak");
    expect(result.edits[0].applied.changes.tasks?.[1].completed).toBe(true);
    expect(result.edits[0].applied.changes.notes).toBe("Dog in the yard.\nBring a ladder.");
    expect(result.summary).toEqual([
      "1418 Oak St: Done: Paint trim",
      "1418 Oak St: Added note: Bring a ladder.",
    ]);
  });

  it("sends a status edit through set_job_status and refuses a notes rewrite", () => {
    const result = plan([
      { op: "job_edit", job: "j2", edit: { op: "set_job_status", status: "completed" } },
      { op: "job_edit", job: "j2", edit: { op: "set_notes", notes: "" } },
    ]);
    expect(result.statuses).toEqual([{ jobId: "oak", from: "pending", to: "completed" }]);
    expect(result.edits).toEqual([]);
    expect(result.skipped).toEqual(["Open 1418 Oak St to change its notes"]);
  });

  it("opens a job on a tab and answers without changes", () => {
    const result = plan([{ op: "open_job", job: "j2", tab: "money" }, { op: "answer" }]);
    expect(result.open).toEqual({ jobId: "oak", tab: "money" });
    expect(result.route).toBeNull();
    expect(result.summary).toEqual([]);
  });

  it("reports a job it can't find", () => {
    expect(plan([{ op: "select_job", job: "j42" }]).skipped).toEqual(["Couldn't find that job"]);
  });
});

describe("globalVoiceResponseSchema", () => {
  it("accepts a nested job edit and a bare answer", () => {
    const parsed = globalVoiceResponseSchema.parse({
      transcript: "Oak is done, add a note",
      ops: [
        { op: "job_edit", job: "j2", edit: { op: "append_notes", text: "Done early." } },
        { op: "answer" },
      ],
      reply: "Added the note.",
    });
    expect(parsed.ops).toHaveLength(2);
  });
});
