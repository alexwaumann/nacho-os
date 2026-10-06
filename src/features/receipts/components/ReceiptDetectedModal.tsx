import { useMutation } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Loader2, Receipt } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import { getDefaultReceiptJobId, rankJobsForReceipt } from "../lib/rankJobs";
import type { Id } from "../../../../convex/_generated/dataModel";

import type { ImageInput } from "@/server/gemini";
import type { ProcessedReceiptData } from "../hooks/useScanReceipt";
import { JobPicker } from "@/components/JobPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUploadImage } from "@/hooks/useUploadImage";
import { formatCurrency, formatDueDate } from "@/lib/utils";

interface ReceiptDetectedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptData: ProcessedReceiptData;
  imageData: ImageInput;
  onCancel: () => void;
}

export function ReceiptDetectedModal({
  open,
  onOpenChange,
  receiptData,
  imageData,
  onCancel,
}: ReceiptDetectedModalProps) {
  // 1. Hooks
  const [pickedJobId, setPickedJobId] = useState<Id<"jobs"> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery(convexQuery(api.jobs.list, {}));
  const createReceipt = useMutation(api.receipts.create);
  const uploadImage = useUploadImage();

  // 2. Derived values
  const ranked = rankJobsForReceipt(jobs);
  const pickerJobs = [...ranked.routeJobs, ...ranked.otherJobs];
  const selectedJobId = pickedJobId ?? getDefaultReceiptJobId(ranked);
  const selectedJob = pickerJobs.find((job) => job._id === selectedJobId);
  const amount = formatCurrency(receiptData.total);

  // 3. Handlers
  const handleSave = async () => {
    if (!selectedJob) return;

    setIsSaving(true);
    try {
      const imageId = await uploadImage(imageData);
      await createReceipt({
        jobId: selectedJob._id,
        imageId,
        storeName: receiptData.storeName,
        storeLocation: receiptData.storeLocation,
        summary: receiptData.summary,
        total: receiptData.total,
        date: receiptData.date,
      });

      toast.success(`Receipt saved: ${receiptData.storeName} ${amount}`, {
        description: `Added to ${selectedJob.address}`,
      });
      onCancel(); // Reset the scan state, which closes the modal
    } catch (error) {
      console.error("Failed to save receipt:", error);
      toast.error("Failed to save receipt", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isSaving) onOpenChange(nextOpen);
  };

  // 4. Render
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md w-[92vw] rounded-4xl p-0 gap-0 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
      >
        {/* Sticky header: what was read off the receipt */}
        <DialogHeader className="shrink-0 gap-0 border-b border-border bg-muted/60 p-5 text-left">
          <div className="flex items-center gap-3">
            <div className="size-11 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center">
              <Receipt size={24} />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground">Receipt found</DialogTitle>
          </div>

          <p className="mt-4 text-[32px] leading-none font-black text-foreground">{amount}</p>
          <p className="mt-2 text-xl font-bold text-foreground break-words">
            {receiptData.storeName}
          </p>
          <p className="text-[17px] text-muted-foreground">{formatDueDate(receiptData.date)}</p>
          {receiptData.summary && (
            <p className="text-[17px] text-muted-foreground line-clamp-2">{receiptData.summary}</p>
          )}
        </DialogHeader>

        {/* Scrollable job list */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          <h2 className="text-lg font-bold text-foreground">Which job is this for?</h2>

          {isLoadingJobs ?
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-muted-foreground" size={28} />
            </div>
          : pickerJobs.length === 0 ?
            <p className="py-8 text-center text-lg text-muted-foreground">
              No open jobs yet. Add a job first.
            </p>
          : <JobPicker
              jobs={pickerJobs}
              selectedJobId={selectedJobId}
              onSelect={setPickedJobId}
              getSectionLabel={(job) => (job.selectedForRoute ? "On today's route" : "Other jobs")}
              label="Which job is this receipt for?"
            />
          }
        </div>

        {/* Sticky footer */}
        <DialogFooter className="shrink-0 border-t border-border bg-background p-5">
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
              className="flex-1 h-14 rounded-2xl text-lg font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!selectedJob || isSaving}
              className="flex-1 h-14 rounded-2xl text-lg font-bold"
            >
              {isSaving ?
                <>
                  <Loader2 className="mr-2 size-5 animate-spin" />
                  Saving...
                </>
              : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
