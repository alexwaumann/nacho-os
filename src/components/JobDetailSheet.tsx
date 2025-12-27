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
  MoreHorizontal,
  Package,
  Plus,
  Receipt,
  Trash2,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Job = Doc<"jobs">;

interface JobDetailSheetProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JobDetailSheet({ job, open, onOpenChange }: JobDetailSheetProps) {
  const [notes, setNotes] = useState("");
  const [newAccessCode, setNewAccessCode] = useState("");

  useEffect(() => {
    if (job?.notes) {
      setNotes(job.notes);
    } else {
      setNotes("");
    }
  }, [job?._id, job?.notes]);

  const updateTask = useMutation(api.jobs.updateTask);
  const updateJob = useMutation(api.jobs.update);
  const updateStatus = useMutation(api.jobs.updateStatus);
  const removeJob = useMutation(api.jobs.remove);
  const toggleRouteSelection = useMutation(api.jobs.toggleSelectedForRoute);

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
    if (notes !== (job.notes ?? "")) {
      await updateJob({ jobId: job._id, notes });
    }
  };

  const handleStatusChange = async (newStatus: "pending" | "completed") => {
    const confirmMsg =
      newStatus === "completed" ?
        "Are you sure you want to mark this job as complete?"
      : "Are you sure you want to mark this job as pending?";

    if (confirm(confirmMsg)) {
      await updateStatus({ jobId: job._id, status: newStatus });
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this job?")) {
      await removeJob({ jobId: job._id });
      onOpenChange(false);
    }
  };

  const handleAddAccessCode = async () => {
    if (!newAccessCode.trim()) return;
    const currentCodes = job.accessCodes ?? [];
    await updateJob({
      jobId: job._id,
      accessCodes: [...currentCodes, newAccessCode.trim()],
    });
    setNewAccessCode("");
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[90vh] data-[vaul-drawer-direction=bottom]:max-h-[90vh] max-w-lg mx-auto flex flex-col p-0 before:hidden bg-background rounded-t-[2.5rem] overflow-hidden shadow-2xl border-t border-border/50">
        <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0 gap-0">
          {/* Sticky Header */}
          <div className="bg-background shrink-0 z-20">
            <DrawerHeader className="text-left px-6 pt-10 pb-4 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1 min-w-0">
                  <DrawerTitle className="text-xl font-black uppercase tracking-tight leading-tight line-clamp-2">
                    <MapPin className="inline-block w-5 h-5 mr-1 -mt-1 text-muted-foreground shrink-0" />
                    {job.address}
                  </DrawerTitle>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon" className="shrink-0 h-10 w-10" />}
                  >
                    <MoreHorizontal className="h-6 w-6" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={openInGoogleMaps}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open in Google Maps
                    </DropdownMenuItem>
                    <Separator className="my-1" />
                    {job.status === "pending" ?
                      <DropdownMenuItem onClick={() => handleStatusChange("completed")}>
                        <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
                        Mark as Complete
                      </DropdownMenuItem>
                    : <DropdownMenuItem onClick={() => handleStatusChange("pending")}>
                        <AlertCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                        Mark as Pending
                      </DropdownMenuItem>
                    }
                    <DropdownMenuItem
                      onClick={handleDelete}
                      className="text-destructive focus:bg-destructive/10 dark:focus:bg-destructive/20"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Job
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <TabsList className="grid w-full grid-cols-2 h-14 bg-muted p-1.5 rounded-2xl">
                <TabsTrigger
                  value="details"
                  className="rounded-xl font-bold uppercase tracking-widest text-xs h-full transition-all text-muted-foreground data-active:bg-card data-active:text-primary data-active:shadow-sm"
                >
                  Details
                </TabsTrigger>
                <TabsTrigger
                  value="tasks"
                  className="rounded-xl font-bold uppercase tracking-widest text-xs h-full transition-all text-muted-foreground data-active:bg-card data-active:text-primary data-active:shadow-sm"
                >
                  Tasks
                </TabsTrigger>
              </TabsList>

              {totalTasks > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <span>Tasks Progress</span>
                    <span>
                      {completedTasks}/{totalTasks}
                    </span>
                  </div>
                  <Progress value={progressValue} className="h-2" />
                </div>
              )}
            </DrawerHeader>
            <Separator />
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-background">
            <TabsContent value="details" className="m-0 p-6 space-y-6 outline-none">
              {/* Route Toggle */}
              <div className="flex items-center justify-between p-5 rounded-3xl bg-muted/30 border border-border/50">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold">Today's Route</Label>
                  <p className="text-xs text-muted-foreground">Include this job in your route</p>
                </div>
                <Switch
                  checked={job.selectedForRoute}
                  onCheckedChange={(checked) =>
                    toggleRouteSelection({ jobId: job._id, selected: checked })
                  }
                />
              </div>

              {/* Dates Section */}
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="bg-primary/5 text-primary border-primary/20 font-bold px-3 py-1.5 rounded-xl"
                >
                  <Calendar className="w-3.5 h-3.5 mr-1.5" />
                  Created: {new Date(job._creationTime).toLocaleDateString()}
                </Badge>
                {job.status === "completed" && job.completedOn && (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/5 text-emerald-600 border-emerald-500/20 font-bold px-3 py-1.5 rounded-xl"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Completed: {job.completedOn}
                  </Badge>
                )}
                {job.status === "paid" && job.paidOn && (
                  <Badge
                    variant="outline"
                    className="bg-blue-500/5 text-blue-600 border-blue-500/20 font-bold px-3 py-1.5 rounded-xl"
                  >
                    <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                    Paid: {job.paidOn}
                  </Badge>
                )}
                {job.status === "pending" && job.dueDate && (
                  <Badge
                    variant="outline"
                    className="bg-orange-500/5 text-orange-600 border-orange-500/20 font-bold px-3 py-1.5 rounded-xl"
                  >
                    <Clock className="w-3.5 h-3.5 mr-1.5" />
                    Due: {job.dueDate}
                  </Badge>
                )}
              </div>

              {/* Scope Summary */}
              {job.summary && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                    Scope Summary
                  </h4>
                  <p className="text-sm font-medium leading-relaxed text-foreground/80">
                    {job.summary}
                  </p>
                </div>
              )}

              {/* Access Codes */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                  <Key className="w-3.5 h-3.5" />
                  Access Codes
                </h4>
                <div className="flex flex-wrap gap-2">
                  {job.accessCodes?.map((code, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="font-mono text-sm px-3 py-1.5 bg-muted/50 rounded-xl"
                    >
                      {code}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="New code..."
                    value={newAccessCode}
                    onChange={(e) => setNewAccessCode(e.target.value)}
                    className="h-12 rounded-2xl"
                    onKeyDown={(e) => e.key === "Enter" && handleAddAccessCode()}
                  />
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={handleAddAccessCode}
                    className="shrink-0 h-12 w-12 rounded-2xl"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Source Document */}
              {sourceImages && sourceImages.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Source Documents
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {sourceImages.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-[3/4] rounded-[1.5rem] bg-muted overflow-hidden border border-border hover:border-primary/30 transition-all group relative"
                      >
                        <img
                          src={url}
                          alt={`Page ${i + 1}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ExternalLink className="w-5 h-5 text-white" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Financials: Receipts */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                    <Receipt className="w-3.5 h-3.5" />
                    Receipts
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] font-black uppercase h-8 px-3 hover:bg-primary/5 text-primary rounded-xl"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add Receipt
                  </Button>
                </div>

                {receipts && receipts.length > 0 ?
                  <div className="space-y-3">
                    {receipts.map((r) => (
                      <Card
                        key={r._id}
                        className="overflow-hidden border-border/50 bg-muted/20 shadow-none rounded-[1.5rem]"
                      >
                        <div className="p-4 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-black truncate">{r.storeName}</div>
                            <div className="text-[10px] font-medium text-muted-foreground truncate">
                              {r.storeLocation || "No location"} •{" "}
                              {new Date(r.date).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-black text-destructive">
                              -${r.total.toFixed(2)}
                            </div>
                            {r.imageUrl && (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-6 p-0 text-[10px] font-black uppercase text-primary"
                                onClick={() => window.open(r.imageUrl!, "_blank")}
                              >
                                View Receipt
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                    <div className="flex justify-between items-center p-5 rounded-[1.5rem] bg-destructive/5 border border-destructive/10">
                      <span className="text-[10px] font-black uppercase tracking-widest text-destructive/70">
                        Total Expenses
                      </span>
                      <span className="text-xl font-black text-destructive">
                        ${totalExpenses.toFixed(2)}
                      </span>
                    </div>
                  </div>
                : <p className="text-xs text-muted-foreground italic text-center py-6 bg-muted/10 rounded-[1.5rem] border border-dashed border-border/50">
                    No receipts added yet.
                  </p>
                }
              </div>

              {/* Financials: Check */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5" />
                  Payment Info
                </h4>
                {payment ?
                  <Card className="overflow-hidden border-border/50 bg-emerald-500/5 border-emerald-500/10 shadow-none rounded-[1.5rem]">
                    <div className="p-5 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black text-emerald-600/70 uppercase tracking-widest mb-1.5">
                          Received from
                        </div>
                        <div className="text-sm font-black truncate">
                          {payment.payerName || "Unknown"}
                        </div>
                        <div className="text-[10px] font-medium text-muted-foreground mt-1">
                          {new Date(payment.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-black text-emerald-600">
                          ${payment.amount.toFixed(2)}
                        </div>
                        {payment.imageUrl && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-6 p-0 text-[10px] font-black uppercase text-emerald-600"
                            onClick={() => window.open(payment.imageUrl!, "_blank")}
                          >
                            View Check
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                : <p className="text-xs text-muted-foreground italic text-center py-6 bg-muted/10 rounded-[1.5rem] border border-dashed border-border/50">
                    No payment record found.
                  </p>
                }
              </div>

              {/* Notes Section */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                  Job Notes
                </h4>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={handleNotesBlur}
                  placeholder="Add private notes about this job..."
                  className="min-h-[140px] rounded-[1.5rem] p-4 resize-none bg-muted/20 border-border/50 focus:bg-background transition-colors"
                />
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="m-0 p-6 outline-none space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                    Tasks Checklist
                  </h4>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-black px-2.5 py-1 rounded-lg"
                  >
                    {completedTasks}/{totalTasks}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {job.tasks?.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => handleTaskToggle(task.id, !task.completed)}
                      className={`w-full flex items-start gap-4 p-5 rounded-[1.5rem] border transition-all text-left ${
                        task.completed ?
                          "bg-muted/30 border-border/50 opacity-80"
                        : "bg-card border-border hover:border-primary/30 shadow-sm"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          task.completed ?
                            "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                        }`}
                      >
                        {task.completed && <CheckCircle2 className="w-4.5 h-4.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-black text-primary uppercase tracking-wider">
                            {task.category}
                          </span>
                          {task.quantity && task.unit && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-2 py-0.5 h-5 border-muted-foreground/20 text-muted-foreground font-bold rounded-lg"
                            >
                              {task.quantity} {task.unit}
                            </Badge>
                          )}
                        </div>
                        <div
                          className={`text-base font-bold leading-tight ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}
                        >
                          {task.taskName}
                        </div>
                        {task.specificInstructions && (
                          <p
                            className={`text-sm mt-2 leading-relaxed ${task.completed ? "text-muted-foreground/70" : "text-muted-foreground font-medium"}`}
                          >
                            {task.specificInstructions}
                          </p>
                        )}
                        {((task.materials?.length ?? 0) > 0 || (task.tools?.length ?? 0) > 0) && (
                          <div className="flex flex-wrap gap-2 mt-4">
                            {task.materials?.map((m, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-[10px] px-2.5 py-0.5 h-6 bg-orange-500/10 text-orange-600 border-orange-500/20 font-bold rounded-lg"
                              >
                                <Package className="w-3 h-3 mr-1.5" />
                                {m}
                              </Badge>
                            ))}
                            {task.tools?.map((t, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-[10px] px-2.5 py-0.5 h-6 bg-blue-500/10 text-blue-600 border-blue-500/20 font-bold rounded-lg"
                              >
                                <Wrench className="w-3 h-3 mr-1.5" />
                                {t}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {task.requiresOnlineOrder && !task.completed && (
                        <Badge
                          variant="destructive"
                          className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 font-black uppercase tracking-tighter rounded-lg"
                        >
                          Order
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
}
