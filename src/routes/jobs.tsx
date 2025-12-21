import { useMutation, useQuery } from "convex/react";
import { Plus, Route as RouteIcon, Search } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Link, createFileRoute } from "@tanstack/react-router";

import { api } from "../../convex/_generated/api";

import type { Doc, Id } from "../../convex/_generated/dataModel";
import JobCard from "@/components/JobCard";
import { JobDetailSheet } from "@/components/JobDetailSheet";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const jobsSearchSchema = z.object({
  filter: z.enum(["pending", "completed", "paid"]).optional().catch("pending"),
});

export const Route = createFileRoute("/jobs")({
  validateSearch: jobsSearchSchema,
  component: JobsPage,
});

type Job = Doc<"jobs">;

function JobsPage() {
  const { filter = "pending" } = Route.useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const jobs = useQuery(api.jobs.list, { status: filter });
  const stats = useQuery(api.jobs.getStats);
  const toggleSelectedForRoute = useMutation(api.jobs.toggleSelectedForRoute);

  const tabs = [
    { id: "pending", label: "Pending" },
    { id: "completed", label: "Completed" },
    { id: "paid", label: "Paid" },
  ] as const;

  // Filter jobs by search query
  const filteredJobs = jobs?.filter((job) =>
    job.address.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setSheetOpen(true);
  };

  const handleToggleRoute = async (jobId: Id<"jobs">, selected: boolean) => {
    await toggleSelectedForRoute({ jobId, selected: !selected });
  };

  return (
    <div className="space-y-6">
      <JobDetailSheet job={selectedJob} open={sheetOpen} onOpenChange={setSheetOpen} />

      {/* Tab Navigation */}
      <div className="bg-muted p-1.5 rounded-2xl flex items-center justify-between">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to="/jobs"
            search={{ filter: tab.id }}
            className={`flex-1 py-3 text-center rounded-xl font-bold transition-all text-sm ${
              filter === tab.id ?
                "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {stats && (
              <span className="ml-1 text-xs opacity-60">
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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-5 space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              Total Jobs
            </p>
            <p className="text-4xl font-black text-foreground">
              {stats ? stats.pending + stats.completed + stats.paid : "-"}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-5 space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              Total Expenses
            </p>
            <p className="text-4xl font-black text-destructive">
              ${stats ? stats.totalExpenses.toFixed(0) : "0"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search jobs..."
          className="pl-10 py-6 bg-card border-border rounded-xl font-medium"
        />
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {jobs === undefined ?
          // Loading state
          <>
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </>
        : filteredJobs && filteredJobs.length > 0 ?
          filteredJobs.map((job) => (
            <div key={job._id} className="relative">
              <JobCard job={job} onClick={() => handleJobClick(job)} />
              {filter === "pending" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleRoute(job._id, job.selectedForRoute);
                  }}
                  className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    job.selectedForRoute ?
                      "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  }`}
                  title={job.selectedForRoute ? "Remove from route" : "Add to route"}
                >
                  <RouteIcon size={16} />
                </button>
              )}
            </div>
          ))
        : <div className="py-12 text-center">
            <p className="text-muted-foreground font-bold">No {filter} jobs found.</p>
            {filter === "pending" && (
              <Link
                to="/"
                search={{ "new-job": "true" }}
                className="text-primary font-bold hover:underline mt-2 inline-flex items-center gap-1"
              >
                <Plus size={16} />
                Add a new job
              </Link>
            )}
          </div>
        }
      </div>
    </div>
  );
}
