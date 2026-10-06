/**
 * Global voice eval: speaks each case with macOS `say`, runs it through the job-less voice agent
 * against a fixture list of jobs and a route, plans the ops and checks the result.
 *
 *   bun evals/globalVoice/run.ts [--only route-question,paid] [--model gemini-3.8-flash]
 *
 * Audio is cached in --audio (default /tmp/global-voice-eval). Requires GEMINI_API_KEY (bun loads
 * .env.local automatically) and macOS (say, afconvert).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { GoogleGenAI } from "@google/genai";

import { interpretGlobalVoiceCommand } from "../../src/features/voice/lib/globalAgent";
import { buildGlobalContext, planGlobalOps } from "../../src/features/voice/lib/globalOps";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import type {
  GlobalFollowUp,
  GlobalPlan,
  GlobalVoiceOp,
} from "../../src/features/voice/lib/globalOps";

const { values: args } = parseArgs({
  options: {
    model: { type: "string" },
    audio: { type: "string", default: "/tmp/global-voice-eval" },
    voice: { type: "string", default: "Fred" },
    only: { type: "string" },
  },
});

const TODAY = "Tuesday, October 6, 2026 (2026-10-06), 8:10 AM";

const task = (id: string, taskName: string, completed = false) => ({
  id,
  taskName,
  category: "General",
  requiresOnlineOrder: false,
  completed,
});

const job = (id: string, created: number, address: string, extra: Partial<Doc<"jobs">> = {}) =>
  ({
    _id: id,
    _creationTime: created,
    address,
    status: "pending",
    selectedForRoute: false,
    tasks: [],
    ...extra,
  }) as unknown as Doc<"jobs">;

// j1 Main (Lufkin), j2 Oak (Austin), j3 Pine (done), j4 Elm (Lufkin); route: Elm, Oak
const JOBS = [
  job("main", 1, "5 Main St, Lufkin, TX 75904", { tasks: [task("m1", "Replace porch light")] }),
  job("oak", 2, "1418 Oak St, Austin, TX 78704", {
    selectedForRoute: true,
    routeOrder: 1,
    accessCodes: ["Gate: 1234"],
    tasks: [task("a", "Fix sink", true), task("b", "Paint trim")],
  }),
  job("pine", 3, "9 Pine Rd, Nacogdoches, TX 75961", { status: "completed" }),
  job("elm", 4, "22 Elm St, Lufkin, TX 75901", {
    selectedForRoute: true,
    routeOrder: 0,
    tasks: [task("e1", "Clean gutters")],
  }),
];
const ROUTE = ["elm", "oak"] as Array<Id<"jobs">>;
const WEATHER = {
  headline: "Dry this morning, rain moving into Lufkin after lunch.",
  stops: [
    {
      jobId: "elm" as Id<"jobs">,
      arrive: "9am",
      hours: [
        "9am: cloudy, 68°",
        "10am: cloudy, 70°",
        "1pm: 40% chance of rain, 72°",
        "2pm: rain likely, 71°",
      ],
    },
    { jobId: "oak" as Id<"jobs">, arrive: "12pm", hours: ["12pm: sunny, 80°", "2pm: sunny, 83°"] },
  ],
};

type Check = (plan: GlobalPlan, reply: string, ops: Array<GlobalVoiceOp>) => string | null;
const check =
  (
    fn: (plan: GlobalPlan, reply: string, ops: Array<GlobalVoiceOp>) => boolean,
    what: string,
  ): Check =>
  (plan, reply, ops) =>
    fn(plan, reply, ops) ? null : what;
const noChanges = check(
  (p) => !p.route && !p.optimize && p.statuses.length === 0 && p.edits.length === 0,
  "nothing should change",
);
const isQuestion = check((_, reply) => reply.trim().endsWith("?"), "should ask a question");

const CASES: Array<{
  id: string;
  say: string;
  previous?: GlobalFollowUp;
  checks: Array<Check>;
}> = [
  {
    id: "route-question",
    say: "What's on my route today?",
    checks: [noChanges, check((_, r) => /elm/i.test(r) && /oak/i.test(r), "names Elm and Oak")],
  },
  {
    id: "add-optimize",
    say: "Put the Main Street job on the route and figure out the best order.",
    checks: [
      check((p) => p.route?.after.includes("main" as Id<"jobs">) ?? false, "Main on the route"),
      check((p) => p.optimize, "optimize"),
    ],
  },
  {
    id: "remove",
    say: "Take Oak Street off today's route.",
    checks: [check((p) => p.route?.after.join() === "elm", "route is just Elm")],
  },
  {
    id: "reorder",
    say: "Do Oak first, then Elm.",
    checks: [check((p) => p.route?.after.join() === "oak,elm", "route is Oak, Elm")],
  },
  {
    id: "paid",
    say: "The Pine Road job paid me today.",
    checks: [
      check((p) => p.statuses.some((s) => s.jobId === "pine" && s.to === "paid"), "Pine paid"),
    ],
  },
  {
    id: "rain",
    say: "Is it going to rain at the Lufkin stop?",
    checks: [noChanges, check((_, r) => /rain/i.test(r) && /2|two/i.test(r), "rain around 2")],
  },
  {
    id: "ambiguous",
    say: "Add a note on the Lufkin job to bring the long ladder.",
    checks: [noChanges, isQuestion],
  },
  {
    id: "answer-ambiguous",
    say: "The one on Elm.",
    previous: {
      transcript: "Add a note on the Lufkin job to bring the long ladder.",
      reply: "Main Street or Elm Street?",
      applied: [],
    },
    checks: [
      check(
        (p) =>
          p.edits.some((e) => e.jobId === "elm" && /ladder/i.test(e.applied.changes.notes ?? "")),
        "ladder note on Elm",
      ),
    ],
  },
  {
    id: "open",
    say: "Pull up the Oak Street job.",
    checks: [check((p) => p.open?.jobId === "oak", "opens Oak")],
  },
  {
    id: "task-done",
    say: "I finished painting the trim at Oak.",
    checks: [
      check(
        (p) => p.edits.some((e) => e.jobId === "oak" && e.applied.changes.tasks?.[1].completed),
        "Oak paint trim done",
      ),
    ],
  },
  {
    id: "missing",
    say: "Add Maple Street to the route.",
    checks: [noChanges, check((_, r) => /maple/i.test(r), "says there's no Maple job")],
  },
  {
    id: "gate-code",
    say: "What's the gate code at Oak?",
    checks: [noChanges, check((_, r) => /1234|one two three four/i.test(r), "says 1234")],
  },
];

function audioFor(id: string, text: string) {
  mkdirSync(args.audio, { recursive: true });
  const aiff = join(args.audio, `${id}.aiff`);
  const m4a = join(args.audio, `${id}.m4a`);
  if (!existsSync(m4a)) {
    execFileSync("say", ["-v", args.voice, "-o", aiff, text]);
    execFileSync("afconvert", ["-f", "m4af", "-d", "aac", aiff, m4a]);
  }
  return { base64: readFileSync(m4a).toString("base64"), mimeType: "audio/mp4" };
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const cases = CASES.filter((c) => !args.only || args.only.split(",").includes(c.id));
const { context, refs } = buildGlobalContext({ jobs: JOBS, route: ROUTE, weather: WEATHER });

const results = await Promise.all(
  cases.map(async (c) => {
    try {
      const result = await interpretGlobalVoiceCommand(
        ai,
        { audio: audioFor(c.id, c.say), context, today: TODAY, previous: c.previous },
        { model: args.model },
      );
      const plan = planGlobalOps({ jobs: JOBS, route: ROUTE }, result.ops, refs, () => "new");
      const failures = c.checks
        .map((fn) => fn(plan, result.reply, result.ops))
        .filter((f): f is string => f !== null);
      return { c, result, failures };
    } catch (error) {
      return { c, result: null, failures: [String(error)] };
    }
  }),
);

for (const { c, result, failures } of results) {
  console.log(`${failures.length ? "✗" : "✓"} ${c.id} ${result?.ms ?? 0}ms — ${result?.reply}`);
  if (failures.length) {
    console.log(`    heard: ${result?.transcript}`);
    console.log(`    ops: ${JSON.stringify(result?.ops)}`);
    console.log(`    ${failures.join("; ")}`);
  }
}
const passed = results.filter((r) => r.failures.length === 0).length;
console.log(`\n${passed}/${results.length} passed`);
