/**
 * Voice command eval: speaks each case with macOS `say`, runs it through the voice agent
 * against a fixture job, applies the ops and checks the resulting job state.
 *
 *   bun evals/voiceCommands/run.ts --configs gemini-3.8-flash:low,gemini-3.5-flash-lite:minimal
 *
 * A config is <model>:<thinking level>. Audio is cached in --audio (default /tmp/voice-eval).
 * Requires GEMINI_API_KEY (bun loads .env.local automatically) and macOS (say, afconvert).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

import { interpretVoiceCommand } from "../../src/features/voice/lib/agent";
import {
  applyVoiceOps,
  buildVoiceContext,
  getVoiceJobState,
} from "../../src/features/voice/lib/ops";
import type { Doc } from "../../convex/_generated/dataModel";
import type { VoiceFollowUp, VoiceJobState } from "../../src/features/voice/lib/ops";

const { values: args } = parseArgs({
  options: {
    configs: { type: "string", default: "gemini-3.8-flash:low" },
    audio: { type: "string", default: "/tmp/voice-eval" },
    voice: { type: "string", default: "Fred" },
    repeats: { type: "string", default: "1" },
    concurrency: { type: "string", default: "6" },
    only: { type: "string" },
  },
});

const TODAY = "Tuesday, October 6, 2026 (2026-10-06)";

const task = (
  id: string,
  taskName: string,
  category: string,
  area: string,
  extra: Partial<NonNullable<Doc<"jobs">["tasks"]>[number]> = {},
) => ({ id, taskName, category, area, requiresOnlineOrder: false, completed: false, ...extra });

const JOB = {
  _id: "job1",
  _creationTime: 0,
  userId: "user1",
  type: "stop",
  address: "1418 Elm St, Austin, TX 78704",
  summary: "Pre-listing repairs: paint, plumbing, exterior cleanup",
  selectedForRoute: true,
  status: "pending",
  dueDate: "2026-10-16",
  notes: "Owner works from home; knock before entering.",
  accessCodes: ["Lockbox: 7731", "Garage: 0912"],
  tasks: [
    task("a", "Paint trim", "Painting", "Living room"),
    task("b", "Replace faucet", "Plumbing", "Kitchen"),
    task("c", "Re-caulk tub", "Caulking", "Hall bathroom", { completed: true }),
    task("d", "Replace exhaust fan", "Electrical", "Hall bathroom"),
    task("e", "Fix leaking sink drain", "Plumbing", "Hall bathroom"),
    task("f", "Clean gutters", "Exterior", "Exterior"),
    task("g", "Replace fence boards", "Carpentry", "Backyard", { quantity: 8, unit: "boards" }),
    task("h", "Stain deck", "Exterior", "Backyard"),
    task("i", "Install ceiling fan", "Electrical", "Master bedroom"),
  ],
} as unknown as Doc<"jobs">;

type Check = (s: VoiceJobState, reply: string) => string | null;

const byId = (s: VoiceJobState, id: string) => s.tasks.find((t) => t.id === id);
const done =
  (id: string, expected = true): Check =>
  (s) =>
    byId(s, id)?.completed === expected ? null : `task ${id} completed should be ${expected}`;
const sameTasksExcept =
  (...ids: Array<string>): Check =>
  (s) => {
    const original = JOB.tasks!.filter((t) => !ids.includes(t.id));
    const changed = original.filter((t) => JSON.stringify(byId(s, t.id)) !== JSON.stringify(t));
    return changed.length ? `unexpected task changes: ${changed.map((t) => t.id).join(",")}` : null;
  };
const check =
  (ok: (s: VoiceJobState, reply: string) => boolean, msg: string): Check =>
  (s, r) =>
    ok(s, r) ? null : msg;

// The fixture job with some tasks already done, for follow-ups to partly applied requests
const withDone = (...ids: Array<string>) =>
  ({
    ...JOB,
    tasks: JOB.tasks!.map((t) => (ids.includes(t.id) ? { ...t, completed: true } : t)),
  }) as Doc<"jobs">;

const BATHROOM_QUESTION = "Which bathroom task did you mean: the exhaust fan or the sink drain?";

const CASES: Array<{
  id: string;
  say: string;
  checks: Array<Check>;
  job?: Doc<"jobs">;
  previous?: VoiceFollowUp;
}> = [
  {
    id: "done-simple",
    say: "I finished painting the trim in the living room.",
    checks: [done("a"), sameTasksExcept("a")],
  },
  {
    id: "done-plus-code",
    say: "Uh, okay so the faucet in the kitchen, that's done. And the gate code is four five two one.",
    checks: [
      done("b"),
      sameTasksExcept("b"),
      check((s) => s.accessCodes.some((c) => c.includes("4521")), "gate code 4521 missing"),
      check((s) => s.accessCodes.length === 3, "should keep the existing codes"),
    ],
  },
  {
    id: "add-task",
    say: "Add a task to replace the smoke detector batteries in the upstairs hallway.",
    checks: [
      check((s) => s.tasks.length === 10, "should have 10 tasks"),
      check((s) => /smoke/i.test(s.tasks.at(-1)?.taskName ?? ""), "new task should mention smoke"),
      check((s) => /hall/i.test(s.tasks.at(-1)?.area ?? ""), "new task area should be hallway"),
      sameTasksExcept(),
    ],
  },
  {
    id: "remove-task",
    say: "Take the gutter cleaning off the list, the owner is doing that himself.",
    checks: [check((s) => !byId(s, "f"), "gutter task should be removed"), sameTasksExcept("f")],
  },
  {
    id: "reorder",
    say: "Move the deck staining to the top of the list.",
    checks: [check((s) => s.tasks[0]?.id === "h", "deck should be first"), sameTasksExcept()],
  },
  {
    id: "due-friday",
    say: "Change the due date to this Friday.",
    checks: [check((s) => s.dueDate === "2026-10-09", "due date should be 2026-10-09")],
  },
  {
    id: "due-clear",
    say: "Get rid of the due date, there's no rush on this one.",
    checks: [check((s) => s.dueDate === null, "due date should be cleared"), sameTasksExcept()],
  },
  {
    id: "note",
    say: "Make a note that the dog is friendly but stays in the backyard, so close the gate.",
    checks: [
      check((s) => /dog/i.test(s.notes) && /gate/i.test(s.notes), "note about dog and gate"),
      check((s) => s.notes.startsWith("Owner works from home"), "existing notes kept"),
      sameTasksExcept(),
    ],
  },
  {
    id: "remove-code",
    say: "Remove the lockbox code, they took the lockbox off.",
    checks: [
      check(
        (s) => s.accessCodes.length === 1 && s.accessCodes[0] === "Garage: 0912",
        "only garage left",
      ),
    ],
  },
  {
    id: "undo-done",
    say: "Actually the tub caulking isn't done yet, I need to redo it.",
    checks: [done("c", false), sameTasksExcept("c")],
  },
  {
    id: "order",
    say: "The ceiling fan needs to be ordered. It's a fifty two inch brushed nickel Hunter fan.",
    checks: [
      check((s) => byId(s, "i")?.requiresOnlineOrder === true, "fan should require order"),
      check((s) => /52/.test(JSON.stringify(byId(s, "i"))), "fan task should mention 52 inch"),
      check((s) => byId(s, "i")?.completed === false, "fan not done"),
    ],
  },
  {
    id: "all-but-one",
    say: "Everything is done except the deck.",
    checks: [
      check(
        (s) => s.tasks.every((t) => t.completed === (t.id !== "h")),
        "all tasks done except deck",
      ),
    ],
  },
  {
    id: "ambiguous",
    say: "Mark the bathroom one done.",
    checks: [
      sameTasksExcept(),
      check((_, reply) => reply.includes("?"), "should ask which bathroom task"),
    ],
  },
  {
    id: "multi",
    say: "Painted the trim, fixed the sink drain, and add a note that I need to come back Thursday for touch ups.",
    checks: [
      done("a"),
      done("e"),
      sameTasksExcept("a", "e"),
      check((s) => /thursday/i.test(s.notes) && /touch/i.test(s.notes), "note about Thursday"),
    ],
  },
  {
    id: "quantity",
    say: "The fence actually needs twelve boards, not eight.",
    checks: [
      check((s) => byId(s, "g")?.quantity === 12, "fence quantity should be 12"),
      sameTasksExcept("g"),
    ],
  },
  {
    id: "change-code",
    say: "The garage code changed, it's now three three eight zero.",
    checks: [
      check(
        (s) => s.accessCodes.length === 2 && s.accessCodes.some((c) => /garage.*3380/i.test(c)),
        "garage code should be 3380 and lockbox kept",
      ),
    ],
  },
  {
    id: "job-complete",
    say: "That's it, this whole job is wrapped up.",
    checks: [check((s) => s.status === "completed", "job should be completed")],
  },
  {
    id: "followup-answer",
    say: "The exhaust fan.",
    previous: { transcript: "Mark the bathroom one done.", reply: BATHROOM_QUESTION, applied: [] },
    checks: [done("d"), sameTasksExcept("d")],
  },
  {
    id: "followup-partial",
    say: "The sink drain.",
    job: withDone("a"),
    previous: {
      transcript: "I painted the trim and the bathroom one is done.",
      reply: `Marked the trim done. ${BATHROOM_QUESTION}`,
      applied: ["Done: Paint trim"],
    },
    checks: [
      done("e"),
      done("a"),
      sameTasksExcept("a", "e"),
      check((s) => s.tasks.length === 9, "no tasks added"),
    ],
  },
  {
    id: "followup-new-task",
    say: "The garage.",
    previous: {
      transcript: "Add a task to replace the light fixture.",
      reply: "Which room is the light fixture in?",
      applied: [],
    },
    checks: [
      check((s) => s.tasks.length === 10, "should add one task"),
      check(
        (s) =>
          /light/i.test(s.tasks.at(-1)?.taskName ?? "") &&
          /garage/i.test(s.tasks.at(-1)?.area ?? ""),
        "new task should be the garage light fixture",
      ),
      sameTasksExcept(),
    ],
  },
  {
    id: "followup-ignored",
    say: "Make a note that the water heater is really old.",
    previous: { transcript: "Mark the bathroom one done.", reply: BATHROOM_QUESTION, applied: [] },
    checks: [
      check((s) => /water heater/i.test(s.notes), "note about the water heater"),
      sameTasksExcept(),
    ],
  },
  {
    id: "nothing",
    say: "Hmm, let me think about that.",
    checks: [
      sameTasksExcept(),
      check((s) => s.notes === JOB.notes && s.dueDate === JOB.dueDate, "nothing should change"),
    ],
  },
];

const THINKING: Record<string, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

function audioFor(id: string, text: string) {
  mkdirSync(args.audio, { recursive: true });
  const aiff = join(args.audio, `${id}.aiff`);
  const m4a = join(args.audio, `${id}.m4a`);
  if (!existsSync(m4a)) {
    execFileSync("say", ["-v", args.voice, "-o", aiff, text]);
    execFileSync("afconvert", ["-f", "m4af", "-d", "aac", aiff, m4a]);
  }
  // MediaRecorder on iOS Safari produces audio/mp4 (AAC), same as this
  return { base64: readFileSync(m4a).toString("base64"), mimeType: "audio/mp4" };
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const cases = CASES.filter((c) => !args.only || args.only.split(",").includes(c.id));
const configs = args.configs.split(",").map((c) => {
  const [model, level = "low"] = c.split(":");
  return { name: c, model, thinkingLevel: THINKING[level] };
});

type Run = { config: string; id: string; failures: Array<string>; ms: number; reply: string };

const jobs = configs.flatMap((config) =>
  cases.flatMap((c) => Array.from({ length: Number(args.repeats) }, () => ({ config, c }))),
);
const runs: Array<Run> = [];

async function worker() {
  for (let next = jobs.shift(); next; next = jobs.shift()) {
    const { config, c } = next;
    const job = c.job ?? JOB;
    const { context, refs } = buildVoiceContext(job);
    const state = getVoiceJobState(job);
    try {
      const result = await interpretVoiceCommand(
        ai,
        { audio: audioFor(c.id, c.say), job: context, today: TODAY, previous: c.previous },
        { model: config.model, thinkingLevel: config.thinkingLevel },
      );
      const applied = applyVoiceOps(state, result.ops, refs, () => "new");
      const after = { ...state, ...applied.changes };
      const failures = c.checks
        .map((fn) => fn(after, result.reply))
        .filter((f): f is string => f !== null);
      runs.push({ config: config.name, id: c.id, failures, ms: result.ms, reply: result.reply });
      const mark = failures.length ? "✗" : "✓";
      console.log(`${mark} ${config.name} ${c.id} ${result.ms}ms — ${result.reply}`);
      if (failures.length) {
        console.log(`    heard: ${result.transcript}`);
        console.log(`    ops: ${JSON.stringify(result.ops)}`);
        console.log(`    ${failures.join("; ")}`);
      }
    } catch (error) {
      runs.push({ config: config.name, id: c.id, failures: [String(error)], ms: 0, reply: "" });
      console.log(`✗ ${config.name} ${c.id} ERROR ${String(error)}`);
    }
  }
}

await Promise.all(Array.from({ length: Number(args.concurrency) }, worker));

console.log("\nconfig | pass | median ms | p90 ms");
for (const { name } of configs) {
  const mine = runs.filter((r) => r.config === name);
  const ms = mine
    .map((r) => r.ms)
    .filter(Boolean)
    .sort((a, b) => a - b);
  const pass = mine.filter((r) => r.failures.length === 0).length;
  const median = ms[Math.floor(ms.length / 2)] ?? 0;
  const p90 = ms[Math.floor(ms.length * 0.9)] ?? 0;
  console.log(`${name} | ${pass}/${mine.length} | ${median} | ${p90}`);
}
