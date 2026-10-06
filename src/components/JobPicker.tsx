import { Check } from "lucide-react";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import { cn, formatDueDate } from "@/lib/utils";

type Job = Doc<"jobs">;

const STATUS_LABELS: Record<Job["status"], string> = {
  pending: "Pending",
  completed: "Completed",
  paid: "Paid",
};

interface JobPickerProps {
  /** Jobs already ranked, in the order they should be shown */
  jobs: Array<Job>;
  selectedJobId: Id<"jobs"> | null;
  onSelect: (jobId: Id<"jobs">) => void;
  /** Marks one job with a "Best match" badge */
  recommendedJobId?: Id<"jobs"> | null;
  /**
   * Group heading for a job, e.g. "On today's route". A heading is shown whenever the label
   * changes from the previous row, so keep jobs of the same group next to each other.
   */
  getSectionLabel?: (job: Job) => string | undefined;
  /** Accessible name for the list */
  label?: string;
  className?: string;
}

/**
 * A big, easy-to-tap list for choosing a job. The street address is the headline of each row.
 */
export function JobPicker({
  jobs,
  selectedJobId,
  onSelect,
  recommendedJobId,
  getSectionLabel,
  label = "Choose a job",
  className,
}: JobPickerProps) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("space-y-3", className)}>
      {jobs.map((job, index) => {
        const sectionLabel = getSectionLabel?.(job);
        const isNewSection =
          sectionLabel !== undefined &&
          (index === 0 || getSectionLabel?.(jobs[index - 1]) !== sectionLabel);

        return (
          <div key={job._id} className="space-y-3">
            {isNewSection && (
              <h3
                className={cn(
                  "px-1 text-base font-bold text-muted-foreground",
                  index > 0 && "pt-3",
                )}
              >
                {sectionLabel}
              </h3>
            )}
            <JobPickerRow
              job={job}
              isSelected={job._id === selectedJobId}
              isRecommended={job._id === recommendedJobId}
              onSelect={() => onSelect(job._id)}
            />
          </div>
        );
      })}
    </div>
  );
}

interface JobPickerRowProps {
  job: Job;
  isSelected: boolean;
  isRecommended: boolean;
  onSelect: () => void;
}

function JobPickerRow({ job, isSelected, isRecommended, onSelect }: JobPickerRowProps) {
  const details = [STATUS_LABELS[job.status], job.dueDate && `Due ${formatDueDate(job.dueDate)}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={cn(
        "w-full min-h-16 rounded-2xl border-2 px-4 py-3 flex items-center gap-4 text-left transition-colors active:scale-[0.99]",
        isSelected ?
          "border-primary bg-primary/10"
        : "border-border bg-card hover:border-primary/50",
      )}
    >
      <div className="flex-1 min-w-0">
        {isRecommended && (
          <span className="mb-1.5 inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100">
            Best match
          </span>
        )}
        <p className="text-xl font-bold leading-snug text-foreground line-clamp-2 break-words">
          {job.address}
        </p>
        <p className="mt-0.5 text-base text-muted-foreground">{details}</p>
      </div>
      <span
        aria-hidden
        className={cn(
          "size-9 shrink-0 rounded-full border-[3px] flex items-center justify-center transition-colors",
          isSelected ?
            "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40",
        )}
      >
        {isSelected && <Check size={22} strokeWidth={3} />}
      </span>
    </button>
  );
}
