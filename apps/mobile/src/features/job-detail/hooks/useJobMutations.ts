import { useMutation } from "convex/react";
import type { OptimisticLocalStore } from "convex/browser";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { toIsoDay } from "@shared/calendar";
import { applyStatusChange, setTaskCompleted } from "@shared/jobs/jobSheet";
import type { JobStatus } from "@shared/jobs/jobSheet";
import { toastError } from "@/components/ui/toast";

/**
 * Patch a job in the local Convex cache: the open sheet (`jobs.get`) and today's route list, so
 * Today shows the change too. Convex drops these patches by itself once the server answers, and
 * rolls them back if the mutation fails.
 */
function patchJob(
  store: OptimisticLocalStore,
  jobId: Id<"jobs">,
  patch: (job: Doc<"jobs">) => Doc<"jobs">,
) {
  const job = store.getQuery(api.jobs.get, { jobId });
  if (job) store.setQuery(api.jobs.get, { jobId }, patch(job));

  const route = store.getQuery(api.jobs.getSelectedForRoute, {});
  if (route?.some((stop) => stop._id === jobId)) {
    store.setQuery(
      api.jobs.getSelectedForRoute,
      {},
      route.map((stop) => (stop._id === jobId ? patch(stop) : stop)),
    );
  }
}

/**
 * The job sheet's edits, each updated on screen right away. They resolve to true when saved;
 * a failed save is undone on screen and shown as an error toast, and resolves to false.
 */
export function useJobMutations(jobId: Id<"jobs">) {
  const updateTaskMutation = useMutation(api.jobs.updateTask).withOptimisticUpdate(
    (store, { taskId, completed }) =>
      patchJob(store, jobId, (job) => ({
        ...job,
        tasks: setTaskCompleted(job.tasks, taskId, completed),
      })),
  );
  const updateJobMutation = useMutation(api.jobs.update).withOptimisticUpdate(
    (store, { jobId: _jobId, dueDate, ...fields }) =>
      patchJob(store, jobId, (job) => ({
        ...job,
        ...fields,
        ...(dueDate !== undefined && { dueDate: dueDate ?? undefined }),
      })),
  );
  const updateStatusMutation = useMutation(api.jobs.updateStatus).withOptimisticUpdate(
    (store, { status }) =>
      patchJob(store, jobId, (job) => applyStatusChange(job, status, toIsoDay(new Date()))),
  );
  const toggleRouteMutation = useMutation(api.jobs.toggleSelectedForRoute).withOptimisticUpdate(
    (store, { selected }) =>
      patchJob(store, jobId, (job) => ({ ...job, selectedForRoute: selected })),
  );
  const removeJobMutation = useMutation(api.jobs.remove);

  const run = async (errorTitle: string, save: () => Promise<unknown>) => {
    try {
      await save();
      return true;
    } catch (error) {
      toastError(errorTitle, error);
      return false;
    }
  };

  return {
    setTaskDone: (taskId: string, completed: boolean) =>
      run("Couldn't update the task", () => updateTaskMutation({ jobId, taskId, completed })),
    setNotes: (notes: string) =>
      run("Couldn't save the notes", () => updateJobMutation({ jobId, notes })),
    setAccessCodes: (accessCodes: string[]) =>
      run("Couldn't save the access codes", () => updateJobMutation({ jobId, accessCodes })),
    setDueDate: (dueDate: string | null) =>
      run("Couldn't save the due date", () => updateJobMutation({ jobId, dueDate })),
    setStatus: (status: JobStatus) =>
      run("Couldn't change the status", () => updateStatusMutation({ jobId, status })),
    setOnRoute: (selected: boolean) =>
      run("Couldn't change today's route", () => toggleRouteMutation({ jobId, selected })),
    removeJob: () => run("Couldn't delete the job", () => removeJobMutation({ jobId })),
  };
}
