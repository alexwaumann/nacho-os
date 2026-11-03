import { useConvexAuth, useMutation, useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { isPdf } from "@convex/lib/media";
import { getErrorMessage } from "@shared/errors";
import { describeJobSource, getAddJobRows } from "@shared/jobs/addJobQueue";
import type { AddJobRow, JobSourceKind } from "@shared/jobs/addJobQueue";
import { toast, toastError } from "@/components/ui/toast";

import type { PickedImage } from "../lib/pickImages";
import {
  addSubmission,
  getSubmission,
  removeSubmissions,
  updateSubmission,
  useSubmissions,
} from "../lib/submissions";
import { uploadImage } from "../lib/uploadImage";

const SEND_FAILED = "Couldn't send it. Check your internet and try again.";

/**
 * Send work orders to be read, like the web's useAddJob: each job's pages (or its PDF) are
 * uploaded to storage and queued (`jobs.enqueueJob`); the server reads them in the background and makes the
 * job. `rows` is the "Reading work orders" list: sending, reading, done (with the new job), or
 * failed (retry, or remove).
 */
export function useAddJob() {
  const { isAuthenticated } = useConvexAuth();
  const submissions = useSubmissions();
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const enqueueJob = useMutation(api.jobs.enqueueJob);
  const removeQueueItem = useMutation(api.jobs.removeQueueItem);

  const queue = useQuery(api.jobs.listQueue, isAuthenticated ? {} : "skip");
  // New jobs are pending; only needed to find the job a finished submission made
  const isWatchingJobs = submissions.some((s) => s.stage === "sent");
  const pendingJobs = useQuery(
    api.jobs.list,
    isAuthenticated && isWatchingJobs ? { status: "pending" } : "skip",
  );
  const rows = getAddJobRows(submissions, queue, pendingJobs);

  // Upload one job's pages and queue it. Returns false if it didn't make it.
  const send = async (id: string): Promise<boolean> => {
    const submission = getSubmission(id);
    if (!submission) return false;
    updateSubmission(id, { stage: "uploading", error: undefined, queueId: undefined });
    try {
      const [firstPage] = submission.pages;
      let queueId;
      let storageIds;
      if (submission.pages.length === 1 && firstPage && isPdf(firstPage.mimeType)) {
        // A PDF goes as-is, with no page images: the server reads it and keeps it with the job
        const sourceFileId = await uploadImage(await generateUploadUrl(), firstPage);
        storageIds = [sourceFileId];
        queueId = await enqueueJob({ fileStorageIds: [], sourceFileId, fileName: submission.name });
      } else {
        // Pages upload in parallel, each with its own one-time upload URL
        storageIds = await Promise.all(
          submission.pages.map(async (page) => uploadImage(await generateUploadUrl(), page)),
        );
        queueId = await enqueueJob({ fileStorageIds: storageIds, fileName: submission.name });
      }
      updateSubmission(id, { stage: "sent", queueId, storageIds });
      return true;
    } catch (error) {
      console.error(`Sending ${submission.name} failed:`, error);
      updateSubmission(id, { stage: "uploadFailed", error: getErrorMessage(error, SEND_FAILED) });
      return false;
    }
  };

  /** Send pictures as new jobs: each group of pages is one job */
  const submit = (kind: JobSourceKind, jobs: PickedImage[][]) =>
    submitNamed(jobs.map((pages) => ({ name: describeJobSource(kind, pages.length), pages })));

  /**
   * Send new jobs with their own names, e.g. files from the Files app: a PDF is a job of its
   * own, named after the file
   */
  const submitNamed = async (jobs: { name: string; pages: PickedImage[] }[]) => {
    // Added last to first, so the newest-first list shows them in the order he picked them
    const ids = jobs
      .filter(({ pages }) => pages.length > 0)
      .reverse()
      .map(({ name, pages }) => addSubmission(name, pages).id)
      .reverse();
    const results = await Promise.all(ids.map(send));
    const sentCount = results.filter(Boolean).length;
    if (sentCount > 0) {
      toast.success(sentCount === 1 ? "Sent" : `Sent ${sentCount} work orders`, {
        description: "The details are being read. This takes about a minute.",
        id: "add-job-sent",
      });
    }
    if (sentCount < results.length) {
      toast.error(results.length === 1 ? "Couldn't send it" : "Some didn't send", {
        description: "Tap Try again in the list.",
        id: "add-job-failed",
      });
    }
  };

  /** Send a failed one again: its pictures (or PDF) are still on the phone */
  const retry = async (row: AddJobRow) => {
    if (!row.submissionId) return;
    // The server deletes a failed job's pictures, so it's a fresh upload and a new queue item
    if (row.queueId) {
      try {
        await removeQueueItem({ queueId: row.queueId });
      } catch (error) {
        console.warn("Removing the failed queue item failed:", error);
      }
    }
    const isSent = await send(row.submissionId);
    if (!isSent) toast.error("Still couldn't send it", { description: SEND_FAILED });
  };

  /** Take a row off the list (a failed one is removed from the server's queue too) */
  const dismiss = async (row: AddJobRow) => {
    if (row.submissionId) removeSubmissions([row.submissionId]);
    if (row.kind === "failed" && row.queueId) {
      try {
        await removeQueueItem({ queueId: row.queueId });
      } catch (error) {
        toastError("Couldn't remove it", error);
      }
    }
  };

  return { rows, isLoading: queue === undefined, submit, submitNamed, retry, dismiss };
}

/** Forget the finished ones among `rows` once he's seen them (when the sheet closes) */
export function clearDoneRows(rows: AddJobRow[]) {
  removeSubmissions(rows.flatMap((row) => (row.kind === "done" ? [row.submissionId] : [])));
}
