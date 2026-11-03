import type { Doc, Id } from "../../convex/_generated/dataModel";

// Adding jobs from paperwork: how pictures are grouped into jobs, what each one is called, and
// the rows of the "Reading work orders" list (this app's uploads plus the server's queue)

export type JobSourceKind = "scan" | "camera" | "library";

/**
 * The name a new job's paperwork goes by until it's read (the queue's `fileName`), e.g.
 * "Scan (2 pages)" or "3 photos".
 */
export function describeJobSource(kind: JobSourceKind, pageCount: number): string {
  if (kind === "scan") return pageCount === 1 ? "Scan" : `Scan (${pageCount} pages)`;
  return pageCount === 1 ? "Photo" : `${pageCount} photos`;
}

/**
 * Split picked pictures into jobs: all pages of one work order ("one"), or a job per picture
 * ("each", like the web app does with several files).
 */
export function groupPages<T>(pages: ReadonlyArray<T>, grouping: "one" | "each"): Array<Array<T>> {
  if (pages.length === 0) return [];
  return grouping === "one" ? [[...pages]] : pages.map((page) => [page]);
}

/** Paperwork sent from this phone: uploading, or queued on the server as `queueId` */
export interface JobSubmission {
  /** Local id, stable across retries */
  id: string;
  name: string;
  stage: "uploading" | "sent" | "uploadFailed";
  queueId?: Id<"jobProcessingQueue">;
  /** The uploaded page images; the finished job lists them as its `sourceImageIds` */
  storageIds?: Array<Id<"_storage">>;
  /** Why the upload failed (stage "uploadFailed") */
  error?: string;
}

export type QueueItem = Pick<Doc<"jobProcessingQueue">, "_id" | "fileName" | "status" | "error">;
export type NewJob = Pick<Doc<"jobs">, "_id" | "address" | "sourceImageIds">;

interface RowBase {
  key: string;
  name: string;
  /** Set when the pictures are on this phone, so a failure can be retried */
  submissionId?: string;
  queueId?: Id<"jobProcessingQueue">;
}

export type AddJobRow =
  | (RowBase & { kind: "uploading" })
  | (RowBase & { kind: "processing" })
  | (RowBase & { kind: "failed"; error: string })
  | (RowBase & { kind: "done"; submissionId: string; jobId: Id<"jobs">; address: string });

const FALLBACK_ERROR = "Couldn't read this one. Try again, or use a clearer picture.";
const NO_ADDRESS_ERROR =
  "Couldn't find the address on it. Try a clearer picture of the whole page.";

/**
 * Why the server couldn't make a job from the pictures, in plain words. Its own messages are
 * fine ("No document found"), but "no address" gets advice and raw library errors are hidden.
 */
export function describeQueueError(error: string | undefined): string {
  const message = error?.trim();
  if (!message) return FALLBACK_ERROR;
  if (/property address/i.test(message)) return NO_ADDRESS_ERROR;
  if (message.startsWith("[") || message.startsWith("{") || message.length > 160) {
    return FALLBACK_ERROR;
  }
  return message;
}

/**
 * The rows of the "Reading work orders" list: this phone's submissions (in the order given,
 * newest first) and then anything else still in the server's queue (sent earlier, or from the
 * website). The server deletes a queue item once its job is made, so a sent submission whose
 * item is gone is done when the job made from its pages turns up in `jobs`. Pass undefined while
 * a query loads.
 */
export function getAddJobRows(
  submissions: ReadonlyArray<JobSubmission>,
  queue: ReadonlyArray<QueueItem> | undefined,
  jobs: ReadonlyArray<NewJob> | undefined,
): Array<AddJobRow> {
  const queueById = new Map((queue ?? []).map((item) => [item._id, item]));
  const rows: Array<AddJobRow> = [];

  for (const submission of submissions) {
    const base = { key: submission.id, name: submission.name, submissionId: submission.id };
    if (submission.stage === "uploading") {
      rows.push({ ...base, kind: "uploading" });
      continue;
    }
    if (submission.stage === "uploadFailed") {
      rows.push({ ...base, kind: "failed", error: submission.error ?? FALLBACK_ERROR });
      continue;
    }

    const item = submission.queueId && queueById.get(submission.queueId);
    if (item) {
      rows.push(
        item.status === "failed" ?
          { ...base, queueId: item._id, kind: "failed", error: describeQueueError(item.error) }
        : { ...base, queueId: item._id, kind: "processing" },
      );
      continue;
    }

    // Gone from the queue: done once its job shows up (the two queries update separately)
    const firstPage = submission.storageIds?.[0];
    const job =
      queue && firstPage ? jobs?.find((j) => j.sourceImageIds?.includes(firstPage)) : undefined;
    rows.push(
      job ?
        { ...base, kind: "done", jobId: job._id, address: job.address }
      : { ...base, queueId: submission.queueId, kind: "processing" },
    );
  }

  const ownQueueIds = new Set(submissions.map((s) => s.queueId).filter(Boolean));
  for (const item of queue ?? []) {
    if (ownQueueIds.has(item._id)) continue;
    const base = { key: item._id, name: item.fileName, queueId: item._id };
    rows.push(
      item.status === "failed" ?
        { ...base, kind: "failed", error: describeQueueError(item.error) }
      : { ...base, kind: "processing" },
    );
  }

  return rows;
}
