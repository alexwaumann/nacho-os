import { AlertCircle, Calendar, CheckCircle2, Clock, DollarSign, MapPin } from "lucide-react";

import type { Doc } from "../../convex/_generated/dataModel";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Job = Doc<"jobs">;

interface JobCardProps {
  job: Job;
  onClick?: () => void;
}

function getStatusBadge(job: Job) {
  const completedTasks = job.tasks?.filter((t) => t.completed).length ?? 0;
  const totalTasks = job.tasks?.length ?? 0;
  const hasOnlineOrderPending = job.tasks?.some((t) => t.requiresOnlineOrder && !t.completed);

  if (job.status === "paid") {
    return {
      label: "Paid",
      variant: "default" as const,
      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      icon: DollarSign,
    };
  }

  if (job.status === "completed") {
    return {
      label: "Completed",
      variant: "default" as const,
      className: "bg-primary/10 text-primary border-primary/20",
      icon: CheckCircle2,
    };
  }

  if (hasOnlineOrderPending) {
    return {
      label: "Parts Needed",
      variant: "destructive" as const,
      className: "bg-destructive/10 text-destructive border-destructive/20",
      icon: AlertCircle,
    };
  }

  if (completedTasks > 0 && completedTasks < totalTasks) {
    return {
      label: "In Progress",
      variant: "default" as const,
      className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      icon: Clock,
    };
  }

  return {
    label: "Pending",
    variant: "secondary" as const,
    className: "bg-secondary text-secondary-foreground border-border",
    icon: Clock,
  };
}

export default function JobCard({ job, onClick }: JobCardProps) {
  const completedTasks = job.tasks?.filter((t) => t.completed).length ?? 0;
  const totalTasks = job.tasks?.length ?? 0;
  const progressValue = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const status = getStatusBadge(job);
  const StatusIcon = status.icon;

  const createdDate = new Date(job._creationTime).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

  // Check if job is new (created within last 24 hours)
  const isNew = Date.now() - job._creationTime < 24 * 60 * 60 * 1000;

  return (
    <Card
      className="border border-border shadow-sm bg-card overflow-hidden active:scale-[0.98] transition-all cursor-pointer hover:border-primary/30"
      onClick={onClick}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-black leading-tight text-foreground uppercase tracking-tight flex-1">
            <MapPin className="inline-block w-4 h-4 mr-1 -mt-0.5 text-muted-foreground" />
            {job.address}
          </h3>
          {isNew && (
            <Badge className="bg-primary text-primary-foreground shrink-0 text-[10px] font-black uppercase tracking-wider">
              New
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-lg text-xs font-bold border border-primary/20">
            <Calendar size={12} />
            {createdDate}
          </div>

          <Badge
            variant={status.variant}
            className={`${status.className} flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg shadow-none uppercase`}
          >
            <StatusIcon size={12} />
            {status.label}
          </Badge>

          {job.dueDate && (
            <div className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-2.5 py-1 rounded-lg text-xs font-bold border border-border">
              <Clock size={12} />
              Due: {job.dueDate}
            </div>
          )}
        </div>

        {job.summary && (
          <p className="text-muted-foreground text-sm font-medium line-clamp-2">{job.summary}</p>
        )}

        {totalTasks > 0 && (
          <div className="space-y-2">
            <div className="flex justify-end">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                {completedTasks}/{totalTasks} tasks
              </span>
            </div>
            <Progress value={progressValue} className="h-2 bg-muted" />
          </div>
        )}

        {job.weather && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-bold">{job.weather.condition}</span>
            <span>{job.weather.tempMax}°F</span>
            {job.weather.precipProb > 20 && (
              <span className="text-primary">{job.weather.precipProb}% rain</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
