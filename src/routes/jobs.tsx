import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import JobCard from "@/components/JobCard";
import { Card, CardContent } from "@/components/ui/card";

const jobsSearchSchema = z.object({
  filter: z.enum(["pending", "completed", "paid"]).optional().catch("pending"),
});

export const Route = createFileRoute("/jobs")({
  validateSearch: jobsSearchSchema,
  component: JobsPage,
});

function JobsPage() {
  const { filter = "pending" } = Route.useSearch();

  const tabs = [
    { id: "pending", label: "Pending" },
    { id: "completed", label: "Completed" },
    { id: "paid", label: "Paid" },
  ] as const;

  return (
    <div className="space-y-6">
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
            <p className="text-4xl font-black text-foreground">1</p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-5 space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              Total Expenses
            </p>
            <p className="text-4xl font-black text-foreground">$0</p>
          </CardContent>
        </Card>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {filter === "pending" ?
          <JobCard
            address="6332 BRISTOLWOOD DR, FORT WORTH, TX 76120"
            createdDate="12/18/2025"
            dueDate="11/03/2025"
            status="Parts Needed"
            description="Perform general rental preparations including Rently lock installation, sticker package..."
            progress={{ current: 0, total: 16 }}
          />
        : <div className="py-12 text-center">
            <p className="text-muted-foreground font-bold">No {filter} jobs found.</p>
          </div>
        }
      </div>
    </div>
  );
}
