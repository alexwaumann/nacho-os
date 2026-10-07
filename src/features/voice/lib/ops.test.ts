import { describe, expect, it } from "vitest";

import { applyVoiceOps, buildVoiceContext, voiceResponseSchema } from "./ops";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import type { VoiceJobState, VoiceOp, VoicePhoto } from "./ops";

const task = (id: string, taskName: string, completed = false) => ({
  id,
  taskName,
  category: "General",
  requiresOnlineOrder: false,
  completed,
});

const job = {
  _id: "job1",
  address: "1 Main St",
  status: "pending",
  dueDate: "2026-10-16",
  notes: "Knock first.",
  accessCodes: ["Lockbox: 7731", "Garage: 0912"],
  tasks: [task("a", "Paint trim"), task("b", "Fix sink", true), task("c", "Stain deck")],
} as unknown as Doc<"jobs">;

const photoId = (value: string) => value as Id<"jobPhotos">;
const photoDocs = [
  { _id: photoId("ph1"), caption: "Kitchen before" },
  { _id: photoId("ph2"), caption: undefined },
];
const photos: Array<VoicePhoto> = [
  { id: photoId("ph1"), caption: "Kitchen before" },
  { id: photoId("ph2"), caption: "" },
];

const { refs } = buildVoiceContext(job, photoDocs);
const state: VoiceJobState = {
  tasks: job.tasks!,
  accessCodes: job.accessCodes!,
  notes: job.notes!,
  dueDate: job.dueDate!,
  status: "pending",
  photos,
};
const apply = (ops: Array<VoiceOp>, from = state) => applyVoiceOps(from, ops, refs, () => "new");

describe("buildVoiceContext", () => {
  it("keys tasks by short refs", () => {
    const { context } = buildVoiceContext(job);
    expect(context.tasks.map((t) => t.ref)).toEqual(["t1", "t2", "t3"]);
    expect(refs.get("t2")).toBe("b");
  });

  it("lists photos oldest first by ref, leaving out empty captions", () => {
    const { context } = buildVoiceContext(job, photoDocs);
    expect(context.photos).toEqual([{ ref: "p1", caption: "Kitchen before" }, { ref: "p2" }]);
    expect(refs.get("p2")).toBe("ph2");
  });
});

describe("applyVoiceOps", () => {
  it("marks tasks done and undone", () => {
    const result = apply([
      { op: "update_task", task: "t1", completed: true },
      { op: "update_task", task: "t2", completed: false },
    ]);
    expect(result.changes.tasks?.map((t) => t.completed)).toEqual([true, false, false]);
    expect(result.previous.tasks).toBe(state.tasks);
    expect(result.summary).toEqual(["Done: Paint trim", "Not done: Fix sink"]);
  });

  it("doesn't report repeated unchanged fields as edits", () => {
    const result = apply([
      { op: "update_task", task: "t1", completed: true, taskName: "Paint trim" },
    ]);
    expect(result.summary).toEqual(["Done: Paint trim"]);
  });

  it("adds, moves and removes tasks", () => {
    const result = apply([
      { op: "add_task", taskName: "Replace bulb", position: 1 },
      { op: "move_task", task: "t3", position: 2 },
      { op: "remove_task", task: "t1" },
    ]);
    expect(result.changes.tasks?.map((t) => t.id)).toEqual(["new", "c", "b"]);
    expect(result.changes.tasks?.[0]).toMatchObject({ category: "General", completed: false });
  });

  it("resolves refs by id, so tasks reordered meanwhile still match", () => {
    const reordered = { ...state, tasks: [state.tasks[2], state.tasks[0], state.tasks[1]] };
    const result = apply([{ op: "update_task", task: "t1", completed: true }], reordered);
    expect(result.changes.tasks?.find((t) => t.id === "a")?.completed).toBe(true);
  });

  it("skips unknown tasks and codes", () => {
    const result = apply([
      { op: "remove_task", task: "t9" },
      { op: "remove_access_code", code: "Side door: 1111" },
    ]);
    expect(result.changes).toEqual({});
    expect(result.skipped).toHaveLength(2);
  });

  it("edits access codes, ignoring duplicates and formatting differences", () => {
    const result = apply([
      { op: "add_access_code", code: "Gate: 4521" },
      { op: "add_access_code", code: "lockbox 7731" },
      { op: "remove_access_code", code: "garage: 0912" },
    ]);
    expect(result.changes.accessCodes).toEqual(["Lockbox: 7731", "Gate: 4521"]);
  });

  it("appends and replaces notes", () => {
    expect(apply([{ op: "append_notes", text: "Dog in yard." }]).changes.notes).toBe(
      "Knock first.\nDog in yard.",
    );
    expect(apply([{ op: "set_notes", notes: "" }]).changes.notes).toBe("");
  });

  it("sets and clears the due date", () => {
    expect(apply([{ op: "set_due_date", date: "2026-10-09" }]).changes).toEqual({
      dueDate: "2026-10-09",
    });
    const cleared = apply([{ op: "clear_due_date" }]);
    expect(cleared.changes).toEqual({ dueDate: null });
    expect(cleared.previous).toEqual({ dueDate: "2026-10-16" });
  });

  it("changes job status but never touches paid jobs", () => {
    expect(apply([{ op: "set_job_status", status: "completed" }]).changes).toEqual({
      status: "completed",
    });
    const paid = { ...state, status: "paid" as const };
    expect(apply([{ op: "set_job_status", status: "pending" }], paid).changes).toEqual({});
  });

  it("only reports fields that changed", () => {
    const result = apply([{ op: "update_task", task: "t2", completed: true }]);
    expect(result.changes).toEqual({});
    expect(result.summary).toEqual([]);
  });
});

describe("voiceResponseSchema", () => {
  it("parses a model response", () => {
    const parsed = voiceResponseSchema.parse({
      transcript: "trim is done",
      ops: [{ op: "update_task", task: "t1", completed: true }],
      reply: "Marked the trim done.",
    });
    expect(parsed.ops[0]).toEqual({ op: "update_task", task: "t1", completed: true });
  });
});

describe("applyVoiceOps photos", () => {
  it("captions a photo and can clear a caption, with undo values", () => {
    const result = apply([
      { op: "set_photo_caption", photo: "p2", caption: " Bathroom 2 " },
      { op: "set_photo_caption", photo: "p1", caption: "" },
    ]);
    expect(result.changes.photos).toEqual([
      { id: "ph1", caption: "" },
      { id: "ph2", caption: "Bathroom 2" },
    ]);
    expect(result.previous.photos).toEqual(photos);
    expect(result.summary).toEqual(["Captioned photo 2: Bathroom 2", "Removed photo 1's caption"]);
    expect(result.addPhoto).toBe(false);
  });

  it("skips an unknown photo and an unchanged caption", () => {
    const result = apply([
      { op: "set_photo_caption", photo: "p9", caption: "Hall" },
      { op: "set_photo_caption", photo: "p1", caption: "Kitchen before" },
    ]);
    expect(result.changes).toEqual({});
    expect(result.skipped).toEqual(["Couldn't find photo p9"]);
  });

  it("flags a request to add a photo without changing anything", () => {
    const result = apply([{ op: "add_photo" }]);
    expect(result.addPhoto).toBe(true);
    expect(result.changes).toEqual({});
    expect(result.summary).toEqual([]);
  });
});
