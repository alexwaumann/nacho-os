/**
 * Job extraction eval: runs the pipeline over a golden set and scores it.
 *
 *   bun evals/jobExtraction/run.ts --docs ~/Downloads/nacho-os \
 *     --golden ~/Downloads/nacho-os/golden-new --out ~/Downloads/nacho-os/evals \
 *     --configs baseline,minimal,low,medium,high --repeats 2
 *
 * Configs: a thinking level (minimal|low|medium|high) runs the two-pass pipeline on the
 * native PDF with that transcription thinking level; "baseline" runs the previous
 * single-pass prompt on page images from --images/<slug>/*.jpg.
 * Requires GEMINI_API_KEY (bun loads .env.local automatically).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { GoogleGenAI, MediaResolution, ThinkingLevel } from "@google/genai";

import { EXTRACTION_MODEL, extractJob } from "../../convex/lib/jobExtraction";
import { baselineToScorable, extractJobBaseline } from "./baseline";
import { averageScores, scoreJob } from "./score";
import type { ExtractedJob, SourceFile } from "../../convex/lib/jobExtraction";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import type { DocScore, ScorableJob } from "./score";

const { values: args } = parseArgs({
  options: {
    docs: { type: "string" },
    golden: { type: "string" },
    out: { type: "string" },
    images: { type: "string", default: "/tmp/eval-images" },
    configs: { type: "string", default: "minimal,low,medium,high" },
    repeats: { type: "string", default: "1" },
    concurrency: { type: "string", default: "4" },
    model: { type: "string", default: EXTRACTION_MODEL },
    resolution: { type: "string", default: "default" },
    escalate: { type: "string", default: "none" },
    enrich: { type: "string", default: "minimal" },
    only: { type: "string" },
  },
});

if (!args.docs || !args.golden || !args.out) {
  throw new Error("--docs, --golden and --out are required");
}

const THINKING: Record<string, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

const RESOLUTION: Record<string, MediaResolution> = {
  default: MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED,
  low: MediaResolution.MEDIA_RESOLUTION_LOW,
  medium: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
  high: MediaResolution.MEDIA_RESOLUTION_HIGH,
};

type Usage = { input: number; output: number; thoughts: number; calls: number };

type RunResult = {
  config: string;
  slug: string;
  repeat: number;
  ms: number;
  usage: Usage;
  error?: string;
  warnings?: Array<string>;
  escalated?: boolean;
  score?: DocScore;
  output?: unknown;
};

const realAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/** A client that records token usage for one run. */
function trackedClient(usage: Usage): GoogleGenAI {
  return {
    models: {
      generateContent: async (params: GenerateContentParameters) => {
        const response: GenerateContentResponse = await realAi.models.generateContent(params);
        const meta = response.usageMetadata;
        usage.calls += 1;
        usage.input += meta?.promptTokenCount ?? 0;
        usage.output += meta?.candidatesTokenCount ?? 0;
        usage.thoughts += meta?.thoughtsTokenCount ?? 0;
        return response;
      },
    },
  } as unknown as GoogleGenAI;
}

function loadGolden(dir: string) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json") && !name.endsWith(".notes.json"))
    .map((name) => {
      const slug = name.replace(/\.json$/, "");
      const notes = JSON.parse(readFileSync(join(dir, `${slug}.notes.json`), "utf8"));
      return {
        slug,
        sourcePdf: notes.sourcePdf as string,
        golden: JSON.parse(readFileSync(join(dir, name), "utf8")) as ExtractedJob,
      };
    })
    .filter((doc) => !args.only || args.only.split(",").includes(doc.slug));
}

function loadImages(slug: string): Array<SourceFile> {
  const dir = join(args.images, slug);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".jpg"))
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]))
    .map((name) => ({
      base64: readFileSync(join(dir, name)).toString("base64"),
      mimeType: "image/jpeg",
    }));
}

async function runOne(
  config: string,
  doc: ReturnType<typeof loadGolden>[number],
  repeat: number,
): Promise<RunResult> {
  const usage: Usage = { input: 0, output: 0, thoughts: 0, calls: 0 };
  const ai = trackedClient(usage);
  const started = Date.now();

  try {
    let predicted: ScorableJob;
    let extra: Partial<RunResult> = {};

    if (config === "baseline") {
      const raw = await extractJobBaseline(ai, args.model, loadImages(doc.slug));
      predicted = baselineToScorable(raw);
      extra = { output: raw };
    } else {
      const pdf: SourceFile = {
        base64: readFileSync(join(args.docs!, doc.sourcePdf)).toString("base64"),
        mimeType: "application/pdf",
      };
      const result = await extractJob(ai, [pdf], {
        model: args.model,
        transcribeThinking: THINKING[config],
        enrichThinking: THINKING[args.enrich],
        mediaResolution: RESOLUTION[args.resolution],
        escalateTo: args.escalate === "none" ? null : THINKING[args.escalate],
      });
      predicted = result.job;
      extra = {
        output: result,
        warnings: result.warnings,
        escalated: result.escalated,
      };
    }

    return {
      config,
      slug: doc.slug,
      repeat,
      ms: Date.now() - started,
      usage,
      score: scoreJob(doc.golden, predicted),
      ...extra,
    };
  } catch (error) {
    return {
      config,
      slug: doc.slug,
      repeat,
      ms: Date.now() - started,
      usage,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function pool<T>(tasks: Array<() => Promise<T>>, size: number): Promise<Array<T>> {
  const results: Array<T> = [];
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({ length: size }, worker));
  return results;
}

const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? "–" : `${(value * 100).toFixed(1)}%`;

async function main() {
  const docs = loadGolden(args.golden!);
  const configs = args.configs.split(",").map((c) => c.trim());
  const repeats = Number(args.repeats);
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(args.out!, runId);
  mkdirSync(outDir, { recursive: true });

  const jobs = configs.flatMap((config) =>
    docs.flatMap((doc) =>
      Array.from({ length: repeats }, (_, repeat) => async () => {
        const result = await runOne(config, doc, repeat);
        writeFileSync(
          join(outDir, `${config}__${doc.slug}__r${repeat}.json`),
          JSON.stringify(result, null, 2),
        );
        const status = result.error ? `ERROR ${result.error}` : pct(result.score?.factsScore);
        console.log(`${config.padEnd(9)} ${doc.slug.padEnd(36)} r${repeat} ${status}`);
        return result;
      }),
    ),
  );

  const results = await pool(jobs, Number(args.concurrency));

  const summary = configs.map((config) => {
    const runs = results.filter((r) => r.config === config);
    const scored = runs.filter((r) => r.score).map((r) => r.score!);
    const perDoc = docs.map((doc) => {
      const docRuns = runs.filter((r) => r.slug === doc.slug && r.score);
      return {
        slug: doc.slug,
        factsScore: docRuns.length ? averageScores(docRuns.map((r) => r.score!)).factsScore : null,
        taskCounts: docRuns.map((r) => r.score!.predictedTasks),
        goldenTasks: doc.golden.tasks.length,
      };
    });
    return {
      config,
      runs: runs.length,
      errors: runs.filter((r) => r.error).length,
      escalations: runs.filter((r) => r.escalated).length,
      avgMs: runs.reduce((sum, r) => sum + r.ms, 0) / runs.length,
      avgUsage: {
        input: runs.reduce((sum, r) => sum + r.usage.input, 0) / runs.length,
        output: runs.reduce((sum, r) => sum + r.usage.output, 0) / runs.length,
        thoughts: runs.reduce((sum, r) => sum + r.usage.thoughts, 0) / runs.length,
      },
      metrics: scored.length ? averageScores(scored) : null,
      perDoc,
    };
  });

  writeFileSync(
    join(outDir, "summary.json"),
    JSON.stringify(
      {
        model: args.model,
        resolution: args.resolution,
        escalate: args.escalate,
        enrich: args.enrich,
        summary,
      },
      null,
      2,
    ),
  );

  const rows: Array<[string, (s: (typeof summary)[number]) => string]> = [
    ["facts score", (s) => pct(s.metrics?.factsScore)],
    ["task F1", (s) => pct(s.metrics?.taskF1)],
    ["task recall", (s) => pct(s.metrics?.taskRecall)],
    ["task precision", (s) => pct(s.metrics?.taskPrecision)],
    ["document type", (s) => pct(s.metrics?.documentType)],
    ["address", (s) => pct(s.metrics?.address)],
    ["due date", (s) => pct(s.metrics?.dueDate)],
    ["access codes", (s) => pct(s.metrics?.accessCodes)],
    ["quantity", (s) => pct(s.metrics?.quantityAccuracy)],
    ["unit", (s) => pct(s.metrics?.unitAccuracy)],
    ["item text", (s) => pct(s.metrics?.itemSimilarity)],
    ["instructions text", (s) => pct(s.metrics?.instructionSimilarity)],
    ["page", (s) => pct(s.metrics?.pageAccuracy)],
    ["approval status", (s) => pct(s.metrics?.statusAccuracy)],
    ["area (lenient)", (s) => pct(s.metrics?.areaAgreement)],
    ["online order (soft)", (s) => pct(s.metrics?.onlineOrderAgreement)],
    ["avg latency", (s) => `${(s.avgMs / 1000).toFixed(1)}s`],
    ["avg input tokens", (s) => Math.round(s.avgUsage.input).toLocaleString()],
    ["avg output tokens", (s) => Math.round(s.avgUsage.output).toLocaleString()],
    ["avg thinking tokens", (s) => Math.round(s.avgUsage.thoughts).toLocaleString()],
    ["errors", (s) => `${s.errors}/${s.runs}`],
    ["escalations", (s) => `${s.escalations}/${s.runs}`],
  ];
  const header = `| metric | ${summary.map((s) => s.config).join(" | ")} |`;
  const divider = `|---|${summary.map(() => "---").join("|")}|`;
  const body = rows.map(([label, fn]) => `| ${label} | ${summary.map(fn).join(" | ")} |`);
  const perDocHeader = `| document (golden tasks) | ${summary.map((s) => s.config).join(" | ")} |`;
  const perDocBody = docs.map(
    (doc, i) =>
      `| ${doc.slug} (${doc.golden.tasks.length}) | ${summary
        .map((s) => `${pct(s.perDoc[i].factsScore)} [${s.perDoc[i].taskCounts.join(",")}]`)
        .join(" | ")} |`,
  );
  const markdown = [
    `model: ${args.model} · resolution: ${args.resolution} · escalate: ${args.escalate} · enrich: ${args.enrich} · repeats: ${repeats}`,
    "",
    header,
    divider,
    ...body,
    "",
    perDocHeader,
    divider,
    ...perDocBody,
  ].join("\n");
  writeFileSync(join(outDir, "summary.md"), markdown);
  console.log(`\n${markdown}\n\nResults: ${outDir}`);
}

await main();
