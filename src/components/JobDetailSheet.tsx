import { useMutation as useConvexMutationHook } from "convex/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  Image as ImageIcon,
  Key,
  Loader2,
  MoreHorizontal,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  ZoomIn,
} from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

import type { JobSheetTab } from "@/features/jobs/hooks/useJobSheet";
import { ImageViewer } from "@/components/ImageViewer";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccessCodesEditor } from "@/features/jobs/components/AccessCodesEditor";
import { DueDateEditor } from "@/features/jobs/components/DueDateEditor";
import { JobNotesEditor } from "@/features/jobs/components/JobNotesEditor";
import { useAddReceipt } from "@/features/jobs/hooks/useAddReceipt";
import { JobPhotosTab } from "@/features/photos/components/JobPhotosTab";
import { clearPhotoIntent, usePhotoIntent } from "@/features/photos/store/photoIntent";
import { VoiceCommandButton } from "@/features/voice/components/VoiceCommandButton";
import { useImageViewer } from "@/hooks/useImageViewer";
import { openExternal } from "@/lib/openExternal";
import { cn, formatDueDate } from "@/lib/utils";

const TAB_TRIGGER_CLASS =
  "rounded-xl font-bold uppercase tracking-wider text-base h-full transition-all text-muted-foreground data-active:bg-card data-active:text-primary data-active:shadow-sm dark:data-active:bg-card dark:data-active:text-primary dark:data-active:border-transparent";

const SECTION_HEADING_CLASS =
  "text-sm font-black text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-2";

// "Lockbox: 7731" → label "Lockbox", code "7731"; anything else is shown whole as the code
function splitAccessCode(code: string) {
  const match = /^([^:]+):\s*(.+)$/.exec(code);
  return match ? { label: match[1].trim(), value: match[2].trim() } : { label: null, value: code };
}

const MENU_ITEM_CLASS = "text-lg py-3";

// Every tab leaves room at the end so the floating mic (bottom-right) never covers the last item
const TAB_CONTENT_CLASS = "m-0 p-5 pb-36 outline-none";

const ALL_TASKS_DONE_TOAST_MS = 15_000;

// Large text and a big "Yes" so the prompt is easy to read and hit
const PROMPT_TOAST_CLASS_NAMES = {
  title: "text-lg! font-bold! leading-snug!",
  actionButton: "h-12! px-5! text-lg! font-black! rounded-xl!",
};

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
}

interface JobDetailSheetProps {
  jobId: Id<"jobs"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: JobSheetTab;
  onTabChange: (tab: JobSheetTab) => void;
}

export function JobDetailSheet({
  jobId,
  open,
  onOpenChange,
  tab,
  onTabChange,
}: JobDetailSheetProps) {
  const queryClient = useQueryClient();
  const receiptInputRef = useRef<HTMLInputElement>(null);
  // The drawer is a modal that blocks pointer events outside itself, so menus must portal into it
  const [drawerContentEl, setDrawerContentEl] = useState<HTMLDivElement | null>(null);

  // Query key for the job - used for optimistic updates
  const jobQueryKey = jobId ? convexQuery(api.jobs.get, { jobId }).queryKey : null;

  // Main job query using TanStack Query with Convex
  const { data: job } = useQuery({
    ...convexQuery(api.jobs.get, { jobId: jobId! }),
    enabled: !!jobId,
  });

  const { data: sourceImages } = useQuery({
    ...convexQuery(api.jobs.getSourceImageUrls, { jobId: jobId! }),
    enabled: !!jobId,
  });
  const { data: receipts } = useQuery({
    ...convexQuery(api.receipts.listByJob, { jobId: jobId! }),
    enabled: !!jobId,
  });
  const { data: payment } = useQuery({
    ...convexQuery(api.payments.getByJob, { jobId: jobId! }),
    enabled: !!jobId,
  });
  const { data: receiptQueue } = useQuery({
    ...convexQuery(api.receipts.listQueueByJob, { jobId: jobId! }),
    enabled: !!jobId,
  });
  const { data: photos } = useQuery({
    ...convexQuery(api.jobPhotos.listByJob, { jobId: jobId! }),
    enabled: !!jobId,
  });

  // "Add a photo" by voice while this job is open: jump to Photos, where the camera button waits
  const photoIntentJobId = usePhotoIntent((state) => state.jobId);
  const showPhotosTab = useEffectEvent(() => {
    if (tab !== "photos") onTabChange("photos");
  });
  useEffect(() => {
    if (open && jobId && photoIntentJobId === jobId) showPhotosTab();
  }, [open, jobId, photoIntentJobId]);

  const handleTabChange = (value: JobSheetTab) => {
    // Leaving Photos on his own means he's not taking that photo now
    if (value !== "photos") clearPhotoIntent();
    onTabChange(value);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) clearPhotoIntent();
    onOpenChange(isOpen);
  };

  // Receipt upload hook
  const { handleAddReceipt, isUploading } = useAddReceipt(jobId);
  const { openViewer, viewerProps } = useImageViewer();
  const dismissQueueItemMutation = useConvexMutationHook(api.receipts.dismissQueueItem);

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleAddReceipt(file);
      e.target.value = ""; // Reset input for next selection
    }
  };

  // Helper to get today's date in YYYY-MM-DD format
  const getTodayDate = () => new Date().toISOString().split("T")[0];

  // Get Convex mutation functions
  const updateTaskConvex = useConvexMutationHook(api.jobs.updateTask);
  const updateJobConvex = useConvexMutationHook(api.jobs.update);
  const updateStatusConvex = useConvexMutationHook(api.jobs.updateStatus);
  const removeJobConvex = useConvexMutationHook(api.jobs.remove);
  const toggleRouteConvex = useConvexMutationHook(api.jobs.toggleSelectedForRoute);

  // Optimistic mutation: Update task completion
  const updateTaskMutation = useMutation({
    mutationFn: (variables: { jobId: Id<"jobs">; taskId: string; completed: boolean }) =>
      updateTaskConvex(variables),
    onMutate: async (variables) => {
      if (!jobQueryKey) return;
      await queryClient.cancelQueries({ queryKey: jobQueryKey });
      const previousJob = queryClient.getQueryData<Doc<"jobs">>(jobQueryKey);
      queryClient.setQueryData<Doc<"jobs">>(jobQueryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks?.map((t) =>
            t.id === variables.taskId ? { ...t, completed: variables.completed } : t,
          ),
        };
      });
      return { previousJob };
    },
    onError: (err, _variables, context) => {
      if (context?.previousJob && jobQueryKey) {
        queryClient.setQueryData(jobQueryKey, context.previousJob);
      }
      toast.error("Failed to update task", { description: String(err) });
    },
  });

  // Optimistic mutation: Update notes
  const updateNotesMutation = useMutation({
    mutationFn: (variables: { jobId: Id<"jobs">; notes: string }) => updateJobConvex(variables),
    onMutate: async (variables) => {
      if (!jobQueryKey) return;
      await queryClient.cancelQueries({ queryKey: jobQueryKey });
      const previousJob = queryClient.getQueryData<Doc<"jobs">>(jobQueryKey);
      queryClient.setQueryData<Doc<"jobs">>(jobQueryKey, (old) => {
        if (!old) return old;
        return { ...old, notes: variables.notes };
      });
      return { previousJob };
    },
    onError: (err, _variables, context) => {
      if (context?.previousJob && jobQueryKey) {
        queryClient.setQueryData(jobQueryKey, context.previousJob);
      }
      toast.error("Failed to save notes", { description: String(err) });
    },
  });

  // Optimistic mutation: Update access codes
  const updateAccessCodesMutation = useMutation({
    mutationFn: (variables: { jobId: Id<"jobs">; accessCodes: Array<string> }) =>
      updateJobConvex(variables),
    onMutate: async (variables) => {
      if (!jobQueryKey) return;
      await queryClient.cancelQueries({ queryKey: jobQueryKey });
      const previousJob = queryClient.getQueryData<Doc<"jobs">>(jobQueryKey);
      queryClient.setQueryData<Doc<"jobs">>(jobQueryKey, (old) => {
        if (!old) return old;
        return { ...old, accessCodes: variables.accessCodes };
      });
      return { previousJob };
    },
    onError: (err, _variables, context) => {
      if (context?.previousJob && jobQueryKey) {
        queryClient.setQueryData(jobQueryKey, context.previousJob);
      }
      toast.error("Failed to update access codes", { description: String(err) });
    },
  });

  // Optimistic mutation: Set or clear (null) the due date
  const updateDueDateMutation = useMutation({
    mutationFn: (variables: { jobId: Id<"jobs">; dueDate: string | null }) =>
      updateJobConvex(variables),
    onMutate: async (variables) => {
      if (!jobQueryKey) return;
      await queryClient.cancelQueries({ queryKey: jobQueryKey });
      const previousJob = queryClient.getQueryData<Doc<"jobs">>(jobQueryKey);
      queryClient.setQueryData<Doc<"jobs">>(jobQueryKey, (old) => {
        if (!old) return old;
        return { ...old, dueDate: variables.dueDate ?? undefined };
      });
      return { previousJob };
    },
    onError: (err, _variables, context) => {
      if (context?.previousJob && jobQueryKey) {
        queryClient.setQueryData(jobQueryKey, context.previousJob);
      }
      toast.error("Failed to update due date", { description: String(err) });
    },
  });

  // Optimistic mutation: Update status
  const updateStatusMutation = useMutation({
    mutationFn: (variables: { jobId: Id<"jobs">; status: "pending" | "completed" | "paid" }) =>
      updateStatusConvex(variables),
    onMutate: async (variables) => {
      if (!jobQueryKey) return;
      await queryClient.cancelQueries({ queryKey: jobQueryKey });
      const previousJob = queryClient.getQueryData<Doc<"jobs">>(jobQueryKey);
      queryClient.setQueryData<Doc<"jobs">>(jobQueryKey, (old) => {
        if (!old) return old;
        const today = getTodayDate();
        return {
          ...old,
          status: variables.status,
          ...(variables.status === "completed" && !old.completedOn ? { completedOn: today } : {}),
          ...(variables.status === "paid" && !old.paidOn ? { paidOn: today } : {}),
        };
      });
      return { previousJob };
    },
    onError: (err, _variables, context) => {
      if (context?.previousJob && jobQueryKey) {
        queryClient.setQueryData(jobQueryKey, context.previousJob);
      }
      toast.error("Failed to update status", { description: String(err) });
    },
  });

  // Optimistic mutation: Toggle route selection
  const toggleRouteMutation = useMutation({
    mutationFn: (variables: { jobId: Id<"jobs">; selected: boolean }) =>
      toggleRouteConvex(variables),
    onMutate: async (variables) => {
      if (!jobQueryKey) return;
      await queryClient.cancelQueries({ queryKey: jobQueryKey });
      const previousJob = queryClient.getQueryData<Doc<"jobs">>(jobQueryKey);
      queryClient.setQueryData<Doc<"jobs">>(jobQueryKey, (old) => {
        if (!old) return old;
        return { ...old, selectedForRoute: variables.selected };
      });
      return { previousJob };
    },
    onError: (err, _variables, context) => {
      if (context?.previousJob && jobQueryKey) {
        queryClient.setQueryData(jobQueryKey, context.previousJob);
      }
      toast.error("Failed to update route selection", { description: String(err) });
    },
  });

  // Mutation: Remove job (no optimistic update needed, just close sheet)
  const removeJobMutation = useMutation({
    mutationFn: (variables: { jobId: Id<"jobs"> }) => removeJobConvex(variables),
    onSuccess: () => {
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error("Failed to delete job", { description: String(err) });
    },
  });

  if (!job) return null;

  const completedTasks = job.tasks?.filter((t) => t.completed).length ?? 0;
  const totalTasks = job.tasks?.length ?? 0;
  const progressValue = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const accessCodes = job.accessCodes ?? [];
  // On a route day he reads the codes at the door, so they ride in the header
  const hasHeaderCodes = job.selectedForRoute && accessCodes.length > 0;
  const allTasksDoneToastId = `all-tasks-done-${job._id}`;

  const setStatus = (status: "pending" | "completed" | "paid") => {
    updateStatusMutation.mutate({ jobId: job._id, status });
  };

  const handleTaskToggle = (taskId: string, completed: boolean) => {
    updateTaskMutation.mutate({ jobId: job._id, taskId, completed });
    if (!completed) {
      toast.dismiss(allTasksDoneToastId);
      return;
    }
    // Checking the last open task offers a one-tap finish
    const isLastOpenTask = job.tasks?.every((t) => t.completed || t.id === taskId) ?? false;
    if (job.status === "pending" && isLastOpenTask) {
      toast("All tasks done. Mark job complete?", {
        id: allTasksDoneToastId,
        duration: ALL_TASKS_DONE_TOAST_MS,
        classNames: PROMPT_TOAST_CLASS_NAMES,
        action: {
          label: "Yes",
          onClick: () =>
            updateStatusMutation.mutate(
              { jobId: job._id, status: "completed" },
              { onSuccess: () => toast.success("Job marked complete") },
            ),
        },
      });
    }
  };

  const handleMarkComplete = () => {
    if (confirm("Mark this job as complete?")) setStatus("completed");
  };

  const handleMarkPending = () => {
    if (confirm("Mark this job as pending? It goes back to your pending jobs.")) {
      setStatus("pending");
    }
  };

  const handleMarkPaid = () => {
    if (confirm("Mark this job as paid?")) setStatus("paid");
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this job?")) {
      removeJobMutation.mutate({ jobId: job._id });
    }
  };

  const openInGoogleMaps = () => {
    if (job.coordinates) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${job.coordinates.lat},${job.coordinates.lng}&travelmode=driving`;
      openExternal(url);
    } else {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`;
      openExternal(url);
    }
  };

  const totalExpenses = receipts?.reduce((sum, r) => sum + r.total, 0) ?? 0;

  const sourceViewerImages = (sourceImages ?? []).map((src) => ({ src, caption: "Work order" }));
  // Only receipts with an image can be paged through in the viewer
  const receiptsWithImages = (receipts ?? []).filter((r) => r.imageUrl);
  const receiptViewerImages = receiptsWithImages.map((r) => ({
    src: r.imageUrl!,
    caption: `${r.storeName} · ${formatMoney(r.total)}`,
  }));

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      {/* dvh, not vh: on iPhone Safari vh is the height with the toolbar hidden, so with the
          toolbar showing 90vh is taller than the screen and the sheet covers it all */}
      <DrawerContent
        ref={setDrawerContentEl}
        className="h-[90dvh] data-[vaul-drawer-direction=bottom]:max-h-[90dvh] max-w-lg mx-auto flex flex-col p-0 before:hidden bg-background rounded-t-[2.5rem] overflow-clip shadow-2xl border-t border-border/50"
      >
        <Tabs
          value={tab}
          onValueChange={handleTabChange}
          className="flex-1 flex flex-col min-h-0 gap-0"
        >
          {/* Sticky Header */}
          <div className="bg-background shrink-0 z-20">
            <DrawerHeader className="text-left px-5 pt-9 pb-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-3 flex-1 min-w-0">
                  <DrawerTitle className="text-left text-xl font-black uppercase tracking-tight leading-tight line-clamp-2">
                    {job.address}
                  </DrawerTitle>
                  {hasHeaderCodes && (
                    <ul aria-label="Access codes" className="flex flex-wrap gap-2">
                      {accessCodes.map((code, i) => {
                        const { label, value } = splitAccessCode(code);
                        return (
                          <li
                            key={i}
                            className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-foreground"
                          >
                            <Key className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                            {label && <span className="text-lg font-bold">{label}</span>}
                            <span className="font-mono text-xl font-black tracking-wider">
                              {value}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="secondary"
                        size="icon"
                        aria-label="More actions"
                        className="shrink-0 h-12 w-12 rounded-full border border-border"
                      />
                    }
                  >
                    <MoreHorizontal className="h-6 w-6" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64" container={drawerContentEl}>
                    {job.status === "pending" ?
                      <DropdownMenuItem onClick={handleMarkComplete} className={MENU_ITEM_CLASS}>
                        <CheckCircle2 className="mr-2 h-5 w-5 text-primary" />
                        Mark as complete
                      </DropdownMenuItem>
                    : <DropdownMenuItem onClick={handleMarkPending} className={MENU_ITEM_CLASS}>
                        <RotateCcw className="mr-2 h-5 w-5" />
                        Mark as pending
                      </DropdownMenuItem>
                    }
                    {job.status === "completed" && (
                      <DropdownMenuItem onClick={handleMarkPaid} className={MENU_ITEM_CLASS}>
                        <DollarSign className="mr-2 h-5 w-5 text-emerald-600" />
                        Mark as paid
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={openInGoogleMaps} className={MENU_ITEM_CLASS}>
                      <ExternalLink className="mr-2 h-5 w-5" />
                      Open in Google Maps
                    </DropdownMenuItem>
                    <Separator className="my-1" />
                    <DropdownMenuItem
                      onClick={handleDelete}
                      className={cn(
                        MENU_ITEM_CLASS,
                        "text-destructive focus:bg-destructive/10 dark:focus:bg-destructive/20",
                      )}
                    >
                      <Trash2 className="mr-2 h-5 w-5" />
                      Delete job
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <TabsList className="grid w-full grid-cols-4 group-data-horizontal/tabs:h-14 bg-muted p-1.5 rounded-2xl">
                <TabsTrigger value="tasks" className={TAB_TRIGGER_CLASS}>
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="info" className={TAB_TRIGGER_CLASS}>
                  Info
                </TabsTrigger>
                <TabsTrigger value="money" className={TAB_TRIGGER_CLASS}>
                  Money
                </TabsTrigger>
                <TabsTrigger
                  value="photos"
                  aria-label="Photos"
                  className={cn(TAB_TRIGGER_CLASS, "gap-1.5")}
                >
                  <Camera className="size-5 shrink-0" aria-hidden />
                  {photos && photos.length > 0 && (
                    <span className="tabular-nums">{photos.length}</span>
                  )}
                </TabsTrigger>
              </TabsList>
            </DrawerHeader>
            <Separator />
          </div>

          {/* Scrollable content. The mic floats over its bottom-right corner on every tab */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-background">
            <TabsContent value="tasks" className={cn(TAB_CONTENT_CLASS, "space-y-5")}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className={SECTION_HEADING_CLASS}>Tasks</h4>
                  <span className="text-lg font-black tabular-nums">
                    {completedTasks} of {totalTasks} done
                  </span>
                </div>
                {totalTasks > 0 && (
                  <Progress value={progressValue} className="h-3" aria-label="Tasks done" />
                )}
              </div>
              {totalTasks === 0 && (
                <p className="text-base text-muted-foreground text-center py-6 bg-muted/10 rounded-[1.5rem] border border-dashed border-border/50">
                  No tasks on this job.
                </p>
              )}
              <div className="space-y-3">
                {job.tasks?.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleTaskToggle(task.id, !task.completed)}
                    className={`w-full flex flex-col gap-3 p-5 rounded-[1.5rem] border transition-all text-left ${
                      task.completed ?
                        "bg-muted/30 border-border/50 opacity-80"
                      : "bg-card border-border hover:border-primary/30 shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          task.completed ?
                            "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                        }`}
                      >
                        {task.completed && <CheckCircle2 className="w-4.5 h-4.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                          <span className="text-xs font-black text-primary uppercase tracking-wider">
                            {task.category}
                          </span>
                          {task.area && (
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              · {task.area}
                            </span>
                          )}
                          {task.quantity && task.unit && (
                            <Badge
                              variant="outline"
                              className="text-xs px-2 py-0.5 h-6 border-muted-foreground/20 text-muted-foreground font-bold rounded-lg"
                            >
                              {task.quantity} {task.unit}
                            </Badge>
                          )}
                          {task.requiresOnlineOrder && !task.completed && (
                            <Badge
                              variant="destructive"
                              className="ml-auto text-xs bg-destructive/10 text-destructive border-destructive/20 font-black uppercase tracking-tighter rounded-lg"
                            >
                              Order
                            </Badge>
                          )}
                        </div>
                        <div
                          className={`text-lg font-bold leading-snug ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}
                        >
                          {task.taskName}
                        </div>
                      </div>
                    </div>
                    {task.sourceItem ?
                      <div
                        className={`rounded-2xl px-4 py-3 ${task.completed ? "bg-muted/40" : "bg-muted"}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1 text-[11px] font-black text-muted-foreground uppercase tracking-[0.14em]">
                          <span>On the sheet</span>
                          {task.page && <span>Page {task.page}</span>}
                        </div>
                        <p
                          className={`text-[15px] font-bold leading-snug ${task.completed ? "text-muted-foreground" : "text-foreground"}`}
                        >
                          {task.sourceItem}
                        </p>
                        {task.specificInstructions && (
                          <p className="text-[15px] mt-1.5 leading-relaxed text-muted-foreground font-medium">
                            {task.specificInstructions}
                          </p>
                        )}
                      </div>
                    : task.specificInstructions && (
                        <p
                          className={`text-base leading-relaxed ${task.completed ? "text-muted-foreground/70" : "text-muted-foreground font-medium"}`}
                        >
                          {task.specificInstructions}
                        </p>
                      )
                    }
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="info" className={cn(TAB_CONTENT_CLASS, "space-y-7")}>
              {/* Route Toggle: the whole row is the label, so tapping anywhere flips it */}
              <label className="flex items-center justify-between gap-4 p-5 rounded-3xl bg-muted/30 border border-border/50 cursor-pointer">
                <span className="space-y-0.5">
                  <span className="block text-lg font-bold">Today's route</span>
                  <span className="block text-base text-muted-foreground">
                    Include this job in your route
                  </span>
                </span>
                <Switch
                  checked={job.selectedForRoute}
                  onCheckedChange={(checked) =>
                    toggleRouteMutation.mutate({ jobId: job._id, selected: checked })
                  }
                  className="mr-3 scale-150"
                />
              </label>

              {job.status === "pending" && (
                <div className="space-y-3">
                  <h4 className={SECTION_HEADING_CLASS}>Due date</h4>
                  <DueDateEditor
                    dueDate={job.dueDate}
                    onChange={(dueDate) =>
                      updateDueDateMutation.mutate({ jobId: job._id, dueDate })
                    }
                  />
                </div>
              )}

              <AccessCodesEditor
                codes={accessCodes}
                onChange={(codes) =>
                  updateAccessCodesMutation.mutate({ jobId: job._id, accessCodes: codes })
                }
              />

              {/* Scope Summary */}
              {job.summary && (
                <div className="space-y-3">
                  <h4 className={SECTION_HEADING_CLASS}>Scope summary</h4>
                  <p className="text-base font-medium leading-relaxed text-foreground/80">
                    {job.summary}
                  </p>
                </div>
              )}

              <JobNotesEditor
                key={job._id}
                notes={job.notes ?? ""}
                onSave={(notes) => updateNotesMutation.mutate({ jobId: job._id, notes })}
              />

              {/* Work order pages */}
              {sourceImages && sourceImages.length > 0 && (
                <div className="space-y-3">
                  <h4 className={SECTION_HEADING_CLASS}>
                    <ImageIcon className="w-4 h-4" />
                    Work order
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {sourceImages.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`View page ${i + 1}`}
                        onClick={() => openViewer(sourceViewerImages, i)}
                        className="aspect-[3/4] rounded-[1.5rem] bg-muted overflow-hidden border border-border hover:border-primary/30 transition-all group relative"
                      >
                        <img
                          src={url}
                          alt={`Page ${i + 1}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="w-6 h-6 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-base text-muted-foreground">
                Added{" "}
                {new Date(job._creationTime).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </TabsContent>

            <TabsContent value="money" className={cn(TAB_CONTENT_CLASS, "space-y-7")}>
              {/* Where the job stands: finished and paid dates */}
              {job.status === "paid" && (
                <div className="p-5 rounded-[1.5rem] bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                  <div className="flex items-center gap-2 text-2xl font-black text-emerald-600">
                    <CheckCircle2 className="h-7 w-7 shrink-0" />
                    {job.paidOn ? `Paid on ${formatDueDate(job.paidOn)}` : "Paid"}
                  </div>
                  {job.completedOn && (
                    <p className="text-base font-medium text-muted-foreground">
                      Finished on {formatDueDate(job.completedOn)}
                    </p>
                  )}
                </div>
              )}
              {job.status === "completed" && (
                <div className="p-5 rounded-[1.5rem] bg-orange-500/10 border border-orange-500/20 space-y-1">
                  <div className="text-2xl font-black text-orange-600">Not paid yet</div>
                  {job.completedOn && (
                    <p className="text-base font-medium text-muted-foreground">
                      Finished on {formatDueDate(job.completedOn)}
                    </p>
                  )}
                </div>
              )}

              {/* Payment (check) */}
              <div className="space-y-3">
                <h4 className={SECTION_HEADING_CLASS}>
                  <DollarSign className="w-4 h-4" />
                  Payment
                </h4>
                {payment ?
                  <Card className="overflow-hidden border-border/50 bg-emerald-500/5 border-emerald-500/10 shadow-none rounded-[1.5rem] py-0">
                    <div className="p-5 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black text-emerald-600/80 uppercase tracking-widest mb-1">
                          Check from
                        </div>
                        <div className="text-lg font-black truncate">
                          {payment.payerName || "Unknown"}
                        </div>
                        <div className="text-base font-medium text-muted-foreground mt-0.5">
                          {new Date(payment.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <div className="text-3xl font-black text-emerald-600 tabular-nums">
                          {formatMoney(payment.amount)}
                        </div>
                        {payment.imageUrl && (
                          <Button
                            variant="outline"
                            className="h-12 px-4 text-base font-bold rounded-xl text-emerald-600"
                            onClick={() =>
                              openViewer([
                                {
                                  src: payment.imageUrl!,
                                  caption: `Check from ${payment.payerName || "Unknown"}`,
                                },
                              ])
                            }
                          >
                            View check
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                : <p className="text-base text-muted-foreground text-center py-6 bg-muted/10 rounded-[1.5rem] border border-dashed border-border/50">
                    No check scanned yet.
                  </p>
                }
              </div>

              {/* Expenses: Receipts */}
              <div className="space-y-4">
                <h4 className={SECTION_HEADING_CLASS}>
                  <Receipt className="w-4 h-4" />
                  Receipts
                </h4>

                <div className="flex items-end justify-between gap-4 p-5 rounded-[1.5rem] bg-destructive/5 border border-destructive/10">
                  <span className="text-base font-bold text-destructive/80">Spent on this job</span>
                  <span className="text-4xl font-black text-destructive tabular-nums">
                    {formatMoney(totalExpenses)}
                  </span>
                </div>

                <Button
                  variant="outline"
                  className="w-full h-14 text-lg font-bold rounded-2xl"
                  onClick={() => receiptInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ?
                    <Loader2 className="size-5 animate-spin" />
                  : <Plus className="size-5" />}
                  {isUploading ? "Uploading..." : "Add Receipt"}
                </Button>

                {/* Hidden file input for receipt capture */}
                <input
                  type="file"
                  ref={receiptInputRef}
                  accept="image/*,application/pdf"
                  capture="environment"
                  onChange={handleReceiptFileChange}
                  className="hidden"
                />

                {/* Processing queue items */}
                {receiptQueue && receiptQueue.length > 0 && (
                  <div className="space-y-3">
                    {receiptQueue.map((item) => (
                      <Card
                        key={item._id}
                        className="overflow-hidden border-border/50 bg-muted/20 shadow-none rounded-[1.5rem] py-0"
                      >
                        <div className="p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {item.status === "failed" ?
                              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                            : <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <div className="text-base font-bold">
                                {item.status === "failed" ?
                                  "Processing failed"
                                : "Processing receipt..."}
                              </div>
                              {item.status === "failed" && item.error && (
                                <div className="text-sm text-muted-foreground truncate">
                                  {item.error}
                                </div>
                              )}
                            </div>
                          </div>
                          {item.status === "failed" && (
                            <Button
                              variant="ghost"
                              className="h-12 px-4 text-base shrink-0"
                              onClick={() => dismissQueueItemMutation({ queueId: item._id })}
                            >
                              Dismiss
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {receipts && receipts.length > 0 ?
                  <div className="space-y-3">
                    {receipts.map((r) => (
                      <Card
                        key={r._id}
                        className="overflow-hidden border-border/50 bg-muted/20 shadow-none rounded-[1.5rem] py-0"
                      >
                        <div className="p-5 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="text-lg font-black truncate">{r.storeName}</div>
                            <div className="text-base font-medium text-muted-foreground truncate">
                              {new Date(r.date).toLocaleDateString()}
                              {r.storeLocation && ` · ${r.storeLocation}`}
                            </div>
                          </div>
                          <div className="text-right shrink-0 space-y-1">
                            <div className="text-xl font-black text-destructive tabular-nums">
                              {formatMoney(r.total)}
                            </div>
                            {r.imageUrl && (
                              <Button
                                variant="outline"
                                className="h-12 px-4 text-base font-bold rounded-xl"
                                onClick={() =>
                                  openViewer(
                                    receiptViewerImages,
                                    receiptsWithImages.findIndex((x) => x._id === r._id),
                                  )
                                }
                              >
                                View
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                : (!receiptQueue || receiptQueue.length === 0) && (
                    <p className="text-base text-muted-foreground text-center py-6 bg-muted/10 rounded-[1.5rem] border border-dashed border-border/50">
                      No receipts added yet.
                    </p>
                  )
                }
              </div>
            </TabsContent>

            <TabsContent value="photos" className={TAB_CONTENT_CLASS}>
              <JobPhotosTab jobId={job._id} photos={photos} />
            </TabsContent>
          </div>
        </Tabs>
        <VoiceCommandButton key={job._id} job={job} isOpen={open} />
        <ImageViewer {...viewerProps} />
      </DrawerContent>
    </Drawer>
  );
}
