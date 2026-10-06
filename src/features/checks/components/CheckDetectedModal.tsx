import { useMutation } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Banknote, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

import type { ProcessedCheckData } from "../hooks/useAddCheck";
import type { ImageInput } from "@/server/gemini";
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
import { findBestAddressMatch } from "@/lib/address";
import { formatCurrency } from "@/lib/utils";

interface CheckDetectedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkData: ProcessedCheckData;
  imageData: ImageInput;
  onCancel: () => void;
}

export function CheckDetectedModal({
  open,
  onOpenChange,
  checkData,
  imageData,
  onCancel,
}: CheckDetectedModalProps) {
  // 1. Hooks
  const [selectedJobId, setSelectedJobId] = useState<Id<"jobs"> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: unpaidJobs = [], isLoading: isLoadingJobs } = useQuery(
    convexQuery(api.jobs.listUnpaid, {}),
  );
  const createPayment = useMutation(api.payments.create);
  const uploadImage = useUploadImage();

  // 2. Derived values: checks usually carry the job address, so the best match goes first
  const recommendedJob =
    checkData.detectedAddress ? findBestAddressMatch(checkData.detectedAddress, unpaidJobs) : null;
  const pickerJobs =
    recommendedJob ?
      [recommendedJob, ...unpaidJobs.filter((job) => job._id !== recommendedJob._id)]
    : unpaidJobs;
  const selectedJob = pickerJobs.find((job) => job._id === selectedJobId);
  const amount = formatCurrency(checkData.amount);

  // 3. Handlers
  const handleSave = async () => {
    if (!selectedJob) return;

    setIsSaving(true);
    try {
      const imageId = await uploadImage(imageData);

      // Create payment record (also marks the job paid)
      await createPayment({
        jobId: selectedJob._id,
        imageId,
        amount: checkData.amount,
        payerName: checkData.payerName,
        detectedAddress: checkData.detectedAddress,
        date: checkData.date,
      });

      toast.success(`Check saved: ${amount}`, {
        description: `Added to ${selectedJob.address}`,
      });
      onCancel(); // Reset the scan state, which closes the modal
    } catch (error) {
      console.error("Failed to save check:", error);
      toast.error("Failed to save check", {
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
        {/* Sticky header: what was read off the check */}
        <DialogHeader className="shrink-0 gap-0 border-b border-border bg-muted/60 p-5 text-left">
          <div className="flex items-center gap-3">
            <div className="size-11 shrink-0 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100 flex items-center justify-center">
              <Banknote size={24} />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground">Check found</DialogTitle>
          </div>

          <p className="mt-4 text-[32px] leading-none font-black text-foreground">{amount}</p>

          <dl className="mt-3 space-y-1 text-[17px]">
            {checkData.payerName && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground">From:</dt>
                <dd className="font-semibold text-foreground break-words">{checkData.payerName}</dd>
              </div>
            )}
            {checkData.detectedAddress && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground">Address:</dt>
                <dd className="font-semibold text-foreground break-words">
                  {checkData.detectedAddress}
                </dd>
              </div>
            )}
          </dl>
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
              No unpaid jobs to put this check on.
            </p>
          : <JobPicker
              jobs={pickerJobs}
              selectedJobId={selectedJobId}
              onSelect={setSelectedJobId}
              recommendedJobId={recommendedJob?._id}
              getSectionLabel={
                recommendedJob ?
                  (job) => (job._id === recommendedJob._id ? undefined : "Other jobs")
                : undefined
              }
              label="Which job is this check for?"
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
