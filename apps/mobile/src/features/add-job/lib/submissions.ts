import { useSyncExternalStore } from "react";

import type { JobSubmission } from "@shared/jobs/addJobQueue";

import type { MediaFile } from "@/features/media/lib/types";
import { discardOpenedFile } from "@/features/open-in/lib/openedFiles";

/** A submission plus its pictures on the phone, kept so a failed one can be sent again */
export interface LocalSubmission extends JobSubmission {
  pages: MediaFile[];
}

// Work orders sent from this phone since the app opened, newest first. Outside React so uploads
// carry on, and the list survives, when he closes the Add Job sheet.
let submissions: LocalSubmission[] = [];
const listeners = new Set<() => void>();
let nextId = 0;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addSubmission(name: string, pages: MediaFile[]): LocalSubmission {
  const submission: LocalSubmission = { id: `job-${nextId++}`, name, pages, stage: "uploading" };
  submissions = [submission, ...submissions];
  emit();
  return submission;
}

export function updateSubmission(id: string, changes: Partial<JobSubmission>) {
  submissions = submissions.map((s) => (s.id === id ? { ...s, ...changes } : s));
  emit();
}

export function removeSubmissions(ids: readonly string[]) {
  if (ids.length === 0) return;
  // A PDF shared to the app is deleted with its row; it isn't needed for a retry any more
  for (const submission of submissions) {
    if (ids.includes(submission.id)) submission.pages.forEach(discardOpenedFile);
  }
  submissions = submissions.filter((s) => !ids.includes(s.id));
  emit();
}

export function getSubmission(id: string) {
  return submissions.find((s) => s.id === id);
}

export function useSubmissions(): LocalSubmission[] {
  return useSyncExternalStore(subscribe, () => submissions);
}
