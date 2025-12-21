import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Image as ImageIcon,
  Key,
  MapPin,
  Package,
  Receipt,
  Trash2,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type Job = Doc<"jobs">;

interface JobDetailSheetProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JobDetailSheet({ job, open, onOpenChange }: JobDetailSheetProps) {
  const [notes, setNotes] = useState(job?.notes ?? "");

  const updateTask = useMutation(api.jobs.updateTask);
  const updateJob = useMutation(api.jobs.update);
  const updateStatus = useMutation(api.jobs.updateStatus);
  const removeJob = useMutation(api.jobs.remove);

  const sourceImages = useQuery(api.jobs.getSourceImageUrls, job ? { jobId: job._id } : "skip");
  const receipts = useQuery(api.receipts.listByJob, job ? { jobId: job._id } : "skip");
  const payment = useQuery(api.payments.getByJob, job ? { jobId: job._id } : "skip");

  if (!job) return null;

  const completedTasks = job.tasks?.filter((t) => t.completed).length ?? 0;
  const totalTasks = job.tasks?.length ?? 0;
  const progressValue = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const handleTaskToggle = async (taskId: string, completed: boolean) => {
    await updateTask({ jobId: job._id, taskId, completed });
  };

  const handleNotesBlur = async () => {
    if (notes !== job.notes) {
      await updateJob({ jobId: job._id, notes });
    }
  };

  const handleMarkComplete = async () => {
    const newStatus = job.status === "pending" ? "completed" : "pending";
    await updateStatus({ jobId: job._id, status: newStatus });
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this job?")) {
      await removeJob({ jobId: job._id });
      onOpenChange(false);
    }
  };

  const openInGoogleMaps = () => {
    if (job.coordinates) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${job.coordinates.lat},${job.coordinates.lng}&travelmode=driving`;
      window.open(url, "_blank");
    } else {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`;
      window.open(url, "_blank");
    }
  };

  const totalExpenses = receipts?.reduce((sum, r) => sum + r.total, 0) ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="data-[side=bottom]:h-[90vh] rounded-t-3xl p-0 overflow-hidden max-w-lg mx-auto flex flex-col"
        showCloseButton={true}
      >
        <div className="flex justify-center py-2 shrink-0">
          <div className="w-10 h-1 bg-muted rounded-full" />
        </div>

        <SheetHeader className="text-left px-6 py-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 flex-1">
              <SheetTitle className="text-xl font-black uppercase tracking-tight">
                <MapPin className="inline-block w-5 h-5 mr-1 -mt-0.5 text-muted-foreground" />
                {job.address}
              </SheetTitle>
              {job.summary && <p className="text-sm text-muted-foreground">{job.summary}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={openInGoogleMaps} className="shrink-0">
              <ExternalLink className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Badge className="bg-primary/10 text-primary border-primary/20">
              <Calendar className="w-3 h-3 mr-1" />
              {new Date(job._creationTime).toLocaleDateString()}
            </Badge>
            {job.dueDate && (
              <Badge variant="secondary" className="border-border">
                <Clock className="w-3 h-3 mr-1" />
                Due: {job.dueDate}
              </Badge>
            )}
            <Badge
              className={
                job.status === "paid" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                : job.status === "completed" ?
                  "bg-primary/10 text-primary border-primary/20"
                : "bg-secondary text-secondary-foreground border-border"
              }
            >
              {job.status === "paid" ?
                <DollarSign className="w-3 h-3 mr-1" />
              : job.status === "completed" ?
                <CheckCircle2 className="w-3 h-3 mr-1" />
              : <Clock className="w-3 h-3 mr-1" />}
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-6">
          {/* Progress */}
          {totalTasks > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-foreground">Tasks Progress</span>
                <span className="text-muted-foreground font-medium">
                  {completedTasks}/{totalTasks}
                </span>
              </div>
              <Progress value={progressValue} className="h-3" />
            </div>
          )}

          <Separator />

          {/* Tasks */}
          {job.tasks && job.tasks.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                Tasks
              </h4>
              <div className="space-y-2">
                {job.tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleTaskToggle(task.id, !task.completed)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                      task.completed ?
                        "bg-muted/50 border-border"
                      : "bg-card border-border hover:border-primary/30"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        task.completed ?
                          "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground"
                      }`}
                    >
                      {task.completed && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <span
                      className={`text-sm font-medium flex-1 ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}
                    >
                      {task.text}
                    </span>
                    {task.requiresOnlineOrder && !task.completed && (
                      <Badge
                        variant="destructive"
                        className="text-[10px] bg-destructive/10 text-destructive border-destructive/20"
                      >
                        Order
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Materials & Tools */}
          {(job.materials?.length ?? 0) > 0 || (job.tools?.length ?? 0) > 0 ?
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                {job.materials && job.materials.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      Materials
                    </h4>
                    <ul className="space-y-1">
                      {job.materials.map((m, i) => (
                        <li key={i} className="text-sm text-foreground">
                          • {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {job.tools && job.tools.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-1">
                      <Wrench className="w-3 h-3" />
                      Tools
                    </h4>
                    <ul className="space-y-1">
                      {job.tools.map((t, i) => (
                        <li key={i} className="text-sm text-foreground">
                          • {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          : null}

          {/* Access Codes */}
          {job.accessCodes && job.accessCodes.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  Access Codes
                </h4>
                <div className="flex flex-wrap gap-2">
                  {job.accessCodes.map((code, i) => (
                    <Badge key={i} variant="secondary" className="font-mono">
                      {code}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Source Images */}
          {sourceImages && sourceImages.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  Source Document
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {sourceImages.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-lg bg-muted overflow-hidden border border-border hover:border-primary/30 transition-colors"
                    >
                      <img src={url} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Financials */}
          <Separator />
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-1">
              <Receipt className="w-3 h-3" />
              Financials
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                    Expenses
                  </div>
                  <div className="text-2xl font-black text-destructive">
                    ${totalExpenses.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {receipts?.length ?? 0} receipts
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                    Payment
                  </div>
                  <div className="text-2xl font-black text-emerald-600">
                    {payment ? `$${payment.amount.toFixed(2)}` : "-"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {payment ? `From ${payment.payerName ?? "Unknown"}` : "No payment"}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Notes */}
          <Separator />
          <div className="space-y-2 pb-6">
            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
              Notes
            </h4>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add notes about this job..."
              className="min-h-[100px] resize-none"
            />
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-6 pt-2 shrink-0 space-y-3 bg-background border-t">
          <Button
            onClick={handleMarkComplete}
            className="w-full py-6"
            variant={job.status === "completed" || job.status === "paid" ? "outline" : "default"}
          >
            {job.status === "pending" ?
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Mark as Complete
              </>
            : <>
                <AlertCircle className="w-5 h-5 mr-2" />
                Mark as Pending
              </>
            }
          </Button>
          <Button
            onClick={handleDelete}
            variant="ghost"
            className="w-full py-6 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-5 h-5 mr-2" />
            Delete Job
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
