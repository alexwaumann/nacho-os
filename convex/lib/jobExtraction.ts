import { MediaResolution, ThinkingLevel, Type } from "@google/genai";
import type { GoogleGenAI, Part, Schema } from "@google/genai";

/**
 * Work-order extraction pipeline.
 *
 * 1. Transcribe (vision): copy the document's facts and every row verbatim, including
 *    declined rows. No inference.
 * 2. Normalize (code): filter by approval status, normalize units/dates, validate counts.
 * 3. Enrich (text only): readable task names, areas, materials, tools, online-order flags,
 *    summary.
 */

export const EXTRACTION_MODEL = "gemini-3.5-flash-lite";

export type SourceFile = {
  base64: string;
  mimeType: string;
};

export type DocumentType =
  | "hudson_work_authorization"
  | "firstkey_scope"
  | "manco_work_order"
  | "inspection_repair_request"
  | "other";

export type ApprovalStatus =
  | "approved"
  | "approved_as_noted"
  | "declined"
  | "pending"
  | "requested"
  | "not_listed";

export type AccessCode = {
  code: string;
  kind: "lockbox" | "gate" | "door" | "alarm" | "garage" | "other";
  note: string | null;
};

export type TranscribedRow = {
  page: number;
  category: string;
  item: string;
  scopeNotes: string;
  ownerNotes: string;
  quantity: number | null;
  unit: string | null;
  approvalStatus: ApprovalStatus;
};

export type Transcription = {
  documentType: DocumentType;
  propertyAddress: string;
  accessCodes: Array<AccessCode>;
  dates: { issued: string | null; bidDue: string | null; targetCompletion: string | null };
  handwrittenNotes: Array<string>;
  conditions: Array<string>;
  approvedCount: number | null;
  rows: Array<TranscribedRow>;
};

export type Enrichment = {
  jobSummary: string;
  tasks: Array<{
    index: number;
    taskName: string;
    area: string | null;
    materials: Array<string>;
    tools: Array<string>;
    requiresOnlineOrder: boolean;
  }>;
};

export type ExtractedTask = {
  page: number;
  area: string | null;
  category: string;
  sourceItem: string;
  taskName: string;
  specificInstructions: string;
  quantity: number | null;
  unit: string | null;
  approvalStatus: ApprovalStatus;
  materials: Array<string>;
  tools: Array<string>;
  requiresOnlineOrder: boolean;
};

export type ExtractedJob = {
  documentType: DocumentType;
  propertyAddress: string;
  jobSummary: string;
  dueDate: string | null;
  accessCodes: Array<AccessCode>;
  notes: Array<string>;
  tasks: Array<ExtractedTask>;
};

export type ExtractionOptions = {
  model?: string;
  transcribeThinking?: ThinkingLevel;
  enrichThinking?: ThinkingLevel;
  mediaResolution?: MediaResolution;
  /** Thinking level for one retry of the transcription when validation fails. */
  escalateTo?: ThinkingLevel | null;
};

export type ExtractionResult = {
  job: ExtractedJob;
  transcription: Transcription;
  warnings: Array<string>;
  escalated: boolean;
};

// Medium was the best accuracy/latency tradeoff in evals/jobExtraction (minimal and low
// misread dates and split rows across page breaks; high was slower with no accuracy gain).
const DEFAULT_OPTIONS: Required<ExtractionOptions> = {
  model: EXTRACTION_MODEL,
  transcribeThinking: ThinkingLevel.MEDIUM,
  enrichThinking: ThinkingLevel.MINIMAL,
  mediaResolution: MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED,
  escalateTo: ThinkingLevel.HIGH,
};

const KEPT_STATUSES = new Set<ApprovalStatus>([
  "approved",
  "approved_as_noted",
  "requested",
  "not_listed",
]);

// --- Pass 1: transcription ---

const TRANSCRIBE_INSTRUCTION = `
<role>
You transcribe property-maintenance work orders into structured data for a handyman's job app.
Copy what the document says. Do not infer, summarize, or fix wording.
</role>

<document_type>
Decide the document type from the layout, not from company names in other fields (a Hudson Homes form may list "Manco United" as the general contractor).
- hudson_work_authorization: Hudson Homes work authorization table with CATEGORY, MATRIX PRICE, SCOPE NOTES, OWNER NOTES, QTY, U/M and APPROVAL STATUS columns.
- firstkey_scope: FirstKey Homes report with Walk Area, Line Item, Details and Qty columns.
- manco_work_order: Manco United estimate (Activity, Description, QTY) or work order with a "Work to be performed" list.
- inspection_repair_request: repair amendment or inspection report listing deficiencies to repair.
- other: anything else.
</document_type>

<rows>
Return one row per line item in document order, including declined and pending rows.
- page: page where the row starts.
- category: section or category as printed (Hudson CATEGORY, FirstKey Walk Area, Manco Activity or room heading, inspection section heading).
- item: line item text as printed (Hudson MATRIX PRICE, FirstKey Line Item, Manco Description or task line, inspection deficiency title).
- scopeNotes: the row's main notes, complete and verbatim as one string, with wrapped lines rejoined: Hudson SCOPE NOTES; FirstKey Details; inspection observation, recommendation and location. "" if empty.
- ownerNotes: secondary notes, complete and verbatim: Hudson OWNER NOTES; FirstKey the group's "Notes:" text. "" if empty.
- Notes are often the only description of the work (e.g. "Off Matrix" rows), so never leave out a note that is printed.
- quantity, unit: QTY and U/M exactly as printed. null when there is no such column or the cell is blank.
- approvalStatus: the status column value (approved, approved_as_noted, declined, pending); requested for items in a repair request; not_listed when the document has no status.

Layout rules:
- A row split across a page break is one row.
- FirstKey: blank Walk Area or Line Item cells repeat the last value above. A "Notes:" line is not a row; put its text in ownerNotes of every row in that Line Item group.
- Manco task lists: room headings are categories, not rows. Lines at the top of a page without a heading keep the previous page's heading.
- Inspection reports: one row per deficiency. Informational items and contract boilerplate are not rows.
</rows>

<header>
- propertyAddress: street, city, state and zip of the property.
- accessCodes: lockbox, gate, door, alarm or garage code values written anywhere, including handwriting. The word "lockbox" or a lockbox install task is not a code.
- dates: issued, bidDue and targetCompletion as YYYY-MM-DD when printed, else null. Do not compute dates from phrases like "3 days before closing".
- handwrittenNotes: handwriting not captured in another field.
- conditions: standing instructions for the whole job (e.g. "Any work exceeding $200 must have prior approval").
- approvedCount: the number of items a printed summary lists as "Approved" (that status only, not "Approved as Noted"), else null.
</header>
`.trim();

const ROW_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    page: { type: Type.INTEGER },
    category: { type: Type.STRING },
    item: { type: Type.STRING },
    scopeNotes: { type: Type.STRING },
    ownerNotes: { type: Type.STRING },
    quantity: { type: Type.NUMBER, nullable: true },
    unit: { type: Type.STRING, nullable: true },
    approvalStatus: {
      type: Type.STRING,
      enum: ["approved", "approved_as_noted", "declined", "pending", "requested", "not_listed"],
    },
  },
  required: [
    "page",
    "category",
    "item",
    "scopeNotes",
    "ownerNotes",
    "quantity",
    "unit",
    "approvalStatus",
  ],
  propertyOrdering: [
    "page",
    "category",
    "item",
    "scopeNotes",
    "ownerNotes",
    "quantity",
    "unit",
    "approvalStatus",
  ],
};

const TRANSCRIPTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    documentType: {
      type: Type.STRING,
      enum: [
        "hudson_work_authorization",
        "firstkey_scope",
        "manco_work_order",
        "inspection_repair_request",
        "other",
      ],
    },
    propertyAddress: { type: Type.STRING },
    accessCodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING },
          kind: {
            type: Type.STRING,
            enum: ["lockbox", "gate", "door", "alarm", "garage", "other"],
          },
          note: { type: Type.STRING, nullable: true },
        },
        required: ["code", "kind", "note"],
      },
    },
    dates: {
      type: Type.OBJECT,
      properties: {
        issued: { type: Type.STRING, nullable: true },
        bidDue: { type: Type.STRING, nullable: true },
        targetCompletion: { type: Type.STRING, nullable: true },
      },
      required: ["issued", "bidDue", "targetCompletion"],
    },
    handwrittenNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
    conditions: { type: Type.ARRAY, items: { type: Type.STRING } },
    approvedCount: { type: Type.INTEGER, nullable: true },
    rows: { type: Type.ARRAY, items: ROW_SCHEMA },
  },
  required: [
    "documentType",
    "propertyAddress",
    "accessCodes",
    "dates",
    "handwrittenNotes",
    "conditions",
    "approvedCount",
    "rows",
  ],
  propertyOrdering: [
    "documentType",
    "propertyAddress",
    "accessCodes",
    "dates",
    "handwrittenNotes",
    "conditions",
    "approvedCount",
    "rows",
  ],
};

// --- Pass 3: enrichment ---

const ENRICH_INSTRUCTION = `
<role>
You help a handyman plan the work in a transcribed work order. Each row is an approved line item.
</role>

<task>
For every row, return its index and:
- taskName: a short checklist title in plain words (at most 8 words), e.g. "Replace washer box caps" or "Paint walls and ceilings, 2 tone". Base it on the notes when the item is generic, such as "Off Matrix - Interior".
- area: the room or location of the work as the row states it, copied from a room-heading category or a location phrase in the notes (e.g. "Both bathrooms", "Bedroom 2", "patio and garage door"). null if the row names no location.
- materials: materials to buy or bring for this task only, short and specific. [] if none.
- tools: tools needed for this task only. [] if none.
- requiresOnlineOrder: true only when the item usually has to be ordered ahead: appliances and model-specific appliance parts, custom-size blinds or screens, cabinets or doors that must match, windows, and vendor-supplied hardware such as Rently locks. false for anything a hardware store stocks.

Also return jobSummary: one sentence of at most 25 words describing the overall scope.
</task>
`.trim();

const ENRICHMENT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    jobSummary: { type: Type.STRING },
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.INTEGER },
          taskName: { type: Type.STRING },
          area: { type: Type.STRING, nullable: true },
          materials: { type: Type.ARRAY, items: { type: Type.STRING } },
          tools: { type: Type.ARRAY, items: { type: Type.STRING } },
          requiresOnlineOrder: { type: Type.BOOLEAN },
        },
        required: ["index", "taskName", "area", "materials", "tools", "requiresOnlineOrder"],
        propertyOrdering: [
          "index",
          "taskName",
          "area",
          "materials",
          "tools",
          "requiresOnlineOrder",
        ],
      },
    },
  },
  required: ["jobSummary", "tasks"],
  propertyOrdering: ["jobSummary", "tasks"],
};

// --- Normalization ---

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(value: string | null): string | null {
  return value && ISO_DATE.test(value.trim()) ? value.trim() : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A target date over a month before the issue date is a misread (e.g. 2024 for 2026). */
function isImplausibleTarget({ issued, targetCompletion }: Transcription["dates"]): boolean {
  return (
    !!issued &&
    !!targetCompletion &&
    Date.parse(targetCompletion) < Date.parse(issued) - 31 * DAY_MS
  );
}

function normalizeUnit(unit: string | null): string | null {
  const trimmed = unit?.trim();
  if (!trimmed) return null;
  if (/^sf\b/i.test(trimmed)) return "SF";
  return /^[a-z]{1,4}$/i.test(trimmed) ? trimmed.toUpperCase() : trimmed;
}

function joinNotes(notes: Array<string>): string {
  return notes
    .map((note) => note.trim().replace(/[.\s]+$/, ""))
    .filter(Boolean)
    .join(". ");
}

function keptRows(transcription: Transcription): Array<TranscribedRow> {
  return transcription.rows.filter((row) => KEPT_STATUSES.has(row.approvalStatus));
}

/** Problems that suggest the transcription is wrong and worth retrying. */
export function validateTranscription(transcription: Transcription): Array<string> {
  const warnings: Array<string> = [];
  const kept = keptRows(transcription);

  if (!transcription.propertyAddress.trim()) warnings.push("No property address found");
  if (kept.length === 0) warnings.push("No approved rows found");
  if (isImplausibleTarget(transcription.dates)) {
    const { issued, targetCompletion } = transcription.dates;
    warnings.push(`Target date ${targetCompletion} is well before issue date ${issued}`);
  }

  const blankOffMatrix = kept.filter(
    (row) => /off matrix/i.test(row.item) && !row.scopeNotes.trim() && !row.ownerNotes.trim(),
  );
  if (blankOffMatrix.length > 0) {
    warnings.push(`${blankOffMatrix.length} "Off Matrix" rows have no notes`);
  }

  const approved = transcription.rows.filter((row) => row.approvalStatus === "approved").length;
  if (transcription.approvedCount !== null && transcription.approvedCount !== approved) {
    warnings.push(
      `Document lists ${transcription.approvedCount} approved items but ${approved} were transcribed`,
    );
  }
  return warnings;
}

// --- Gemini calls ---

function parseJson<T>(text: string | undefined, label: string): T {
  try {
    return JSON.parse(text ?? "") as T;
  } catch {
    console.error(`Failed to parse ${label} JSON:`, text);
    throw new Error(`Failed to parse ${label} response`);
  }
}

export async function transcribeDocument(
  ai: GoogleGenAI,
  model: string,
  files: Array<SourceFile>,
  thinkingLevel: ThinkingLevel,
  mediaResolution: MediaResolution,
): Promise<Transcription> {
  const fileParts: Array<Part> = files.map((file) => ({
    inlineData: { data: file.base64, mimeType: file.mimeType },
  }));

  const response = await ai.models.generateContent({
    model,
    contents: [...fileParts, { text: "Transcribe this work order." }],
    config: {
      systemInstruction: TRANSCRIBE_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: TRANSCRIPTION_SCHEMA,
      thinkingConfig: { thinkingLevel },
      mediaResolution,
    },
  });

  return parseJson<Transcription>(response.text, "transcription");
}

export async function enrichRows(
  ai: GoogleGenAI,
  model: string,
  transcription: Transcription,
  rows: Array<TranscribedRow>,
  thinkingLevel: ThinkingLevel,
): Promise<Enrichment> {
  const input = {
    documentType: transcription.documentType,
    conditions: transcription.conditions,
    rows: rows.map((row, index) => ({
      index,
      category: row.category,
      item: row.item,
      notes: [row.scopeNotes, row.ownerNotes].filter(Boolean),
      quantity: row.quantity,
      unit: row.unit,
    })),
  };

  const response = await ai.models.generateContent({
    model,
    contents: [{ text: JSON.stringify(input, null, 2) }],
    config: {
      systemInstruction: ENRICH_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: ENRICHMENT_SCHEMA,
      thinkingConfig: { thinkingLevel },
    },
  });

  return parseJson<Enrichment>(response.text, "enrichment");
}

export function buildJob(transcription: Transcription, enrichment: Enrichment): ExtractedJob {
  const enrichedByIndex = new Map(enrichment.tasks.map((task) => [task.index, task]));

  const tasks = keptRows(transcription).map((row, index): ExtractedTask => {
    const enriched = enrichedByIndex.get(index);
    return {
      page: row.page,
      area: enriched?.area?.trim() || null,
      category: row.category.trim() || "General",
      sourceItem: row.item.trim(),
      taskName: enriched?.taskName.trim() || row.item.trim(),
      specificInstructions: joinNotes([row.scopeNotes, row.ownerNotes]),
      quantity: typeof row.quantity === "number" ? row.quantity : null,
      unit: normalizeUnit(row.unit),
      approvalStatus: row.approvalStatus,
      materials: enriched?.materials ?? [],
      tools: enriched?.tools ?? [],
      requiresOnlineOrder: enriched?.requiresOnlineOrder ?? false,
    };
  });

  return {
    documentType: transcription.documentType,
    propertyAddress: transcription.propertyAddress.trim(),
    jobSummary: enrichment.jobSummary.trim(),
    dueDate:
      isImplausibleTarget(transcription.dates) ? null : (
        normalizeDate(transcription.dates.targetCompletion)
      ),
    accessCodes: transcription.accessCodes.filter((code) => code.code.trim()),
    notes: [...transcription.conditions, ...transcription.handwrittenNotes]
      .map((note) => note.trim())
      .filter(Boolean),
    tasks,
  };
}

/**
 * Extract a job from a work order (a PDF, or one or more page images).
 */
export async function extractJob(
  ai: GoogleGenAI,
  files: Array<SourceFile>,
  options: ExtractionOptions = {},
): Promise<ExtractionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let transcription = await transcribeDocument(
    ai,
    opts.model,
    files,
    opts.transcribeThinking,
    opts.mediaResolution,
  );
  let warnings = validateTranscription(transcription);
  let escalated = false;

  if (warnings.length > 0 && opts.escalateTo && opts.escalateTo !== opts.transcribeThinking) {
    const retry = await transcribeDocument(
      ai,
      opts.model,
      files,
      opts.escalateTo,
      opts.mediaResolution,
    );
    const retryWarnings = validateTranscription(retry);
    if (retryWarnings.length < warnings.length) {
      transcription = retry;
      warnings = retryWarnings;
      escalated = true;
    }
  }

  const rows = keptRows(transcription);
  const enrichment =
    rows.length > 0 ?
      await enrichRows(ai, opts.model, transcription, rows, opts.enrichThinking)
    : { jobSummary: "", tasks: [] };

  return { job: buildJob(transcription, enrichment), transcription, warnings, escalated };
}
