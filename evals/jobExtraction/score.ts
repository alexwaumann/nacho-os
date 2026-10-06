import type { ExtractedJob, ExtractedTask } from "../../convex/lib/jobExtraction";

/**
 * Scores an extraction against a golden ExtractedJob.
 *
 * Facts (document type, address, due date, access codes, which rows, quantity, unit,
 * instructions) are graded strictly. Inferred fields (task names, materials, tools,
 * online-order flags) are reported as agreement only.
 */

/** A job as produced by any pipeline; fields the pipeline can't produce are null. */
export type ScorableJob = Omit<ExtractedJob, "documentType" | "tasks"> & {
  documentType: ExtractedJob["documentType"] | null;
  tasks: Array<
    Omit<ExtractedTask, "page" | "approvalStatus"> & {
      page: number | null;
      approvalStatus: ExtractedTask["approvalStatus"] | null;
    }
  >;
};

export type DocScore = {
  documentType: number | null;
  address: number;
  dueDate: number;
  accessCodes: number;
  goldenTasks: number;
  predictedTasks: number;
  matchedTasks: number;
  taskRecall: number;
  taskPrecision: number;
  taskF1: number;
  itemSimilarity: number;
  instructionSimilarity: number;
  quantityAccuracy: number;
  unitAccuracy: number;
  pageAccuracy: number | null;
  statusAccuracy: number | null;
  areaAgreement: number;
  onlineOrderAgreement: number;
  /** Mean of the strict fact metrics. */
  factsScore: number;
};

const ADDRESS_WORDS: Record<string, string> = {
  drive: "dr",
  street: "st",
  avenue: "ave",
  road: "rd",
  circle: "cir",
  lane: "ln",
  court: "ct",
  boulevard: "blvd",
  north: "n",
  south: "s",
  east: "e",
  west: "w",
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeAddress(value: string): string {
  return normalizeText(value)
    .split(" ")
    .map((word) => ADDRESS_WORDS[word] ?? word)
    .join(" ");
}

function bigrams(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  const padded = ` ${value} `;
  for (let i = 0; i < padded.length - 1; i++) {
    const gram = padded.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

/** Dice coefficient over character bigrams of the normalized strings (1 when both empty). */
export function similarity(a: string | null | undefined, b: string | null | undefined): number {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);
  let overlap = 0;
  let total = 0;
  for (const count of leftGrams.values()) total += count;
  for (const [gram, count] of rightGrams) {
    total += count;
    overlap += Math.min(count, leftGrams.get(gram) ?? 0);
  }
  return (2 * overlap) / total;
}

const MATCH_THRESHOLD = 0.5;

type AlignableTask = { sourceItem: string; specificInstructions: string };

function taskText(task: AlignableTask): string {
  return `${task.sourceItem} ${task.specificInstructions}`;
}

/** Order-preserving alignment that maximizes total similarity of matched tasks. */
function alignTasks<TGolden extends AlignableTask, TPredicted extends AlignableTask>(
  golden: Array<TGolden>,
  predicted: Array<TPredicted>,
): Array<[TGolden, TPredicted]> {
  const n = golden.length;
  const m = predicted.length;
  const sims = golden.map((g) => predicted.map((p) => similarity(taskText(g), taskText(p))));
  const best = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sim = sims[i - 1][j - 1];
      const diagonal = sim >= MATCH_THRESHOLD ? best[i - 1][j - 1] + sim : -Infinity;
      best[i][j] = Math.max(best[i - 1][j], best[i][j - 1], diagonal);
    }
  }

  const pairs: Array<[TGolden, TPredicted]> = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const sim = sims[i - 1][j - 1];
    if (sim >= MATCH_THRESHOLD && best[i][j] === best[i - 1][j - 1] + sim) {
      pairs.unshift([golden[i - 1], predicted[j - 1]]);
      i--;
      j--;
    } else if (best[i][j] === best[i - 1][j]) {
      i--;
    } else {
      j--;
    }
  }
  return pairs;
}

function mean(values: Array<number>): number {
  return values.length === 0 ? 1 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function codeSet(job: Pick<ExtractedJob, "accessCodes">): string {
  return job.accessCodes
    .map((c) => c.code.replace(/\s+/g, ""))
    .sort()
    .join("|");
}

function sameUnit(a: string | null, b: string | null): boolean {
  return (a ?? "").trim().toUpperCase() === (b ?? "").trim().toUpperCase();
}

function sameQuantity(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < 1e-6;
}

export function scoreJob(golden: ExtractedJob, predicted: ScorableJob): DocScore {
  const pairs = alignTasks(golden.tasks, predicted.tasks);
  const matched = pairs.length;
  const recall = golden.tasks.length ? matched / golden.tasks.length : 1;
  const precision = predicted.tasks.length ? matched / predicted.tasks.length : 0;
  const f1 = recall + precision > 0 ? (2 * recall * precision) / (recall + precision) : 0;

  const hasPages = predicted.tasks.some((t) => t.page !== null);
  const hasStatus = predicted.tasks.some((t) => t.approvalStatus !== null);

  const score: Omit<DocScore, "factsScore"> = {
    documentType:
      predicted.documentType === null ?
        null
      : Number(predicted.documentType === golden.documentType),
    address: Number(
      normalizeAddress(golden.propertyAddress) === normalizeAddress(predicted.propertyAddress),
    ),
    dueDate: Number((golden.dueDate ?? null) === (predicted.dueDate ?? null)),
    accessCodes: Number(codeSet(golden) === codeSet(predicted)),
    goldenTasks: golden.tasks.length,
    predictedTasks: predicted.tasks.length,
    matchedTasks: matched,
    taskRecall: recall,
    taskPrecision: precision,
    taskF1: f1,
    itemSimilarity: mean(pairs.map(([g, p]) => similarity(g.sourceItem, p.sourceItem))),
    instructionSimilarity: mean(
      pairs.map(([g, p]) => similarity(g.specificInstructions, p.specificInstructions)),
    ),
    quantityAccuracy: mean(pairs.map(([g, p]) => Number(sameQuantity(g.quantity, p.quantity)))),
    unitAccuracy: mean(pairs.map(([g, p]) => Number(sameUnit(g.unit, p.unit)))),
    pageAccuracy: hasPages ? mean(pairs.map(([g, p]) => Number(g.page === p.page))) : null,
    statusAccuracy:
      hasStatus ? mean(pairs.map(([g, p]) => Number(g.approvalStatus === p.approvalStatus))) : null,
    areaAgreement: mean(
      pairs.map(([g, p]) =>
        Number(
          (g.area === null && p.area === null) ||
            (g.area !== null && p.area !== null && similarity(g.area, p.area) >= 0.5),
        ),
      ),
    ),
    onlineOrderAgreement: mean(
      pairs.map(([g, p]) => Number(g.requiresOnlineOrder === p.requiresOnlineOrder)),
    ),
  };

  // Row-level metrics are scaled by recall so dropped rows can't inflate them.
  const factsScore = mean([
    ...(score.documentType === null ? [] : [score.documentType]),
    score.address,
    score.dueDate,
    score.accessCodes,
    score.taskF1,
    score.quantityAccuracy * recall,
    score.unitAccuracy * recall,
    score.instructionSimilarity * recall,
  ]);

  return { ...score, factsScore };
}

export function averageScores(scores: Array<DocScore>): Record<keyof DocScore, number | null> {
  const keys = Object.keys(scores[0]) as Array<keyof DocScore>;
  return Object.fromEntries(
    keys.map((key) => {
      const values = scores.map((s) => s[key]).filter((v): v is number => v !== null);
      return [key, values.length ? mean(values) : null];
    }),
  ) as Record<keyof DocScore, number | null>;
}
