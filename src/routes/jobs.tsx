import { useMutation } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { List, Map as MapIcon, Plus, Search } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Link, createFileRoute } from "@tanstack/react-router";

import { api } from "../../convex/_generated/api";

import type { Id } from "../../convex/_generated/dataModel";
import JobCard from "@/components/JobCard";
import { JobDetailSheet } from "@/components/JobDetailSheet";
import { Input } from "@/components/ui/input";
import { JobsMap } from "@/features/jobs/components/JobsMap";
import { jobSheetSearchSchema, useJobSheet } from "@/features/jobs/hooks/useJobSheet";
import { sortJobsByDueDate } from "@/features/jobs/lib/dueDate";
import { cn } from "@/lib/utils";

const jobsSearchSchema = z.object({
  filter: z.enum(["pending", "completed", "paid"]).optional().catch("pending"),
  // List is the default and is left out of the URL
  view: z.enum(["list", "map"]).optional().catch(undefined),
  ...jobSheetSearchSchema,
});

export const Route = createFileRoute("/jobs")({
  validateSearch: jobsSearchSchema,
  component: JobsPage,
});

const filterTabs = [
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "paid", label: "Paid" },
] as const;

const viewTabs = [
  { id: "list", label: "List", icon: List },
  { id: "map", label: "Map", icon: MapIcon },
] as const;

function JobsPage() {
  const { filter = "pending", view = "list" } = Route.useSearch();
  const jobSheet = useJobSheet();
  const { data: stats } = useQuery(convexQuery(api.jobs.getStats, {}));

  return (
    <div className="space-y-4">
      <JobDetailSheet
        jobId={jobSheet.jobId}
        open={jobSheet.isOpen}
        onOpenChange={jobSheet.handleOpenChange}
        tab={jobSheet.tab}
        onTabChange={jobSheet.setTab}
      />

      {/* Status filter */}
      <div className="bg-muted p-1.5 rounded-2xl flex items-center justify-between">
        {filterTabs.map((tab) => (
          <Link
            key={tab.id}
            to="/jobs"
            search={(prev) => ({ ...prev, filter: tab.id, job: undefined, tab: undefined })}
            className={cn(
              "flex-1 min-h-12 py-3 text-center rounded-xl font-bold transition-all text-base",
              filter === tab.id ?
                "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {stats && (
              <span className="ml-1 text-sm opacity-60">
                (
                {tab.id === "pending" ?
                  stats.pending
                : tab.id === "completed" ?
                  stats.completed
                : stats.paid}
                )
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* List / Map toggle */}
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Show jobs as">
        {viewTabs.map((tab) => (
          <Link
            key={tab.id}
            to="/jobs"
            search={(prev) => ({ ...prev, view: tab.id === "list" ? undefined : tab.id })}
            aria-current={view === tab.id ? "page" : undefined}
            className={cn(
              "h-14 rounded-2xl border-2 flex items-center justify-center gap-2 text-lg font-bold transition-colors",
              view === tab.id ?
                "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-card text-foreground border-border hover:bg-muted",
            )}
          >
            <tab.icon size={22} />
            {tab.label}
          </Link>
        ))}
      </div>

      {view === "map" ?
        <JobsMap onOpenJob={jobSheet.openJob} isFilterIgnored={filter !== "pending"} />
      : <JobsList filter={filter} onOpenJob={jobSheet.openJob} />}
    </div>
  );
}

interface JobsListProps {
  filter: "pending" | "completed" | "paid";
  onOpenJob: (jobId: Id<"jobs">) => void;
}

function JobsList({ filter, onOpenJob }: JobsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: jobs } = useQuery(convexQuery(api.jobs.list, { status: filter }));
  const toggleSelectedForRoute = useMutation(api.jobs.toggleSelectedForRoute);

  const matchingJobs = jobs?.filter((job) =>
    job.address.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  // Pending work is listed by what's due first; done jobs stay newest first
  const visibleJobs =
    filter === "pending" && matchingJobs ? sortJobsByDueDate(matchingJobs) : matchingJobs;

  const handleToggleRoute = async (jobId: Id<"jobs">, selected: boolean) => {
    await toggleSelectedForRoute({ jobId, selected: !selected });
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by address"
          aria-label="Search jobs by address"
          className="pl-12 h-13 text-base md:text-base bg-card border-border rounded-xl font-medium"
        />
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {visibleJobs && visibleJobs.length > 0 ?
          visibleJobs.map((job) => (
            <JobCard
              key={job._id}
              job={job}
              onClick={() => onOpenJob(job._id)}
              onToggleRoute={
                filter === "pending" ?
                  () => handleToggleRoute(job._id, job.selectedForRoute)
                : undefined
              }
            />
          ))
        : <div className="py-12 text-center">
            <p className="text-muted-foreground font-bold text-base">No {filter} jobs found.</p>
            {filter === "pending" && (
              <Link
                to="/"
                search={{ "new-job": "true" }}
                className="text-primary font-bold hover:underline mt-2 inline-flex items-center gap-1 min-h-12 text-base"
              >
                <Plus size={18} />
                Add a new job
              </Link>
            )}
          </div>
        }
      </div>
    </div>
  );
}
