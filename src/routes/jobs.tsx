import { useMutation } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Link, createFileRoute } from "@tanstack/react-router";

import { api } from "../../convex/_generated/api";

import type { Id } from "../../convex/_generated/dataModel";
import JobCard from "@/components/JobCard";
import { JobDetailSheet } from "@/components/JobDetailSheet";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const jobsSearchSchema = z.object({
  filter: z.enum(["pending", "completed", "paid"]).optional().catch("pending"),
});

export const Route = createFileRoute("/jobs")({
  validateSearch: jobsSearchSchema,
  component: JobsPage,
});

function JobsPage() {
  const { filter = "pending" } = Route.useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<Id<"jobs"> | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: jobs } = useQuery(convexQuery(api.jobs.list, { status: filter }));
  const { data: stats } = useQuery(convexQuery(api.jobs.getStats, {}));
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

  const handleJobClick = (jobId: Id<"jobs">) => {
    setSelectedJobId(jobId);
    setSheetOpen(true);
  };

  const handleToggleRoute = async (jobId: Id<"jobs">, selected: boolean) => {
    await toggleSelectedForRoute({ jobId, selected: !selected });
  };

  return (
    <div className="space-y-6">
      <JobDetailSheet jobId={selectedJobId} open={sheetOpen} onOpenChange={setSheetOpen} />

      {/* Tab Navigation */}
      <div className="bg-muted p-1.5 rounded-2xl flex items-center justify-between">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to="/jobs"
            search={{ filter: tab.id }}
            className={`flex-1 py-3 text-center rounded-xl font-bold transition-all text-base ${
              filter === tab.id ?
                "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
            }`}
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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border border-border shadow-sm bg-card py-0">
          <CardContent className="p-5 space-y-1">
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">
              Total Jobs
            </p>
            <p className="text-4xl font-black text-foreground">
              {stats ? stats.pending + stats.completed + stats.paid : "-"}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card py-0">
          <CardContent className="p-5 space-y-1">
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">
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
        {filteredJobs && filteredJobs.length > 0 ?
          filteredJobs.map((job) => (
            <JobCard
              key={job._id}
              job={job}
              onClick={() => handleJobClick(job._id)}
              onToggleRoute={
                filter === "pending" ?
                  () => handleToggleRoute(job._id, job.selectedForRoute)
                : undefined
              }
            />
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
