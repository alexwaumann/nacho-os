import { useMutation } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { CheckCircle2, Loader2, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

import type { ProcessedCheckData } from "../hooks/useAddCheck";
import type { ImageInput } from "@/server/gemini";
import { findBestAddressMatch } from "@/lib/address";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CheckDetectedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkData: ProcessedCheckData;
  imageData: ImageInput;
  onCancel: () => void;
}

type Job = Doc<"jobs">;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function JobSelectionCard({
  job,
  isSelected,
  isRecommended,
  onSelect,
}: {
  job: Job;
  isSelected: boolean;
  isRecommended: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-xl border-2 text-left transition-all",
        isSelected ?
          "border-primary bg-primary/5"
        : "border-border bg-card hover:border-primary/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={14} className="text-muted-foreground shrink-0" />
            <p className="font-medium text-sm truncate">{job.address}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={job.status === "completed" ? "default" : "secondary"}
              className="text-xs"
            >
              {job.status === "completed" ? "Completed" : "Pending"}
            </Badge>
            {isRecommended && (
              <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                Recommended
              </Badge>
            )}
          </div>
        </div>
        <div
          className={cn(
            "w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
            isSelected ? "border-primary bg-primary" : "border-muted-foreground/30",
          )}
        >
          {isSelected && <CheckCircle2 size={12} className="text-primary-foreground" />}
        </div>
      </div>
    </button>
  );
}

export function CheckDetectedModal({
  open,
  onOpenChange,
  checkData,
  imageData,
  onCancel,
}: CheckDetectedModalProps) {
  const [selectedJobId, setSelectedJobId] = useState<Id<"jobs"> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: unpaidJobs = [], isLoading: isLoadingJobs } = useQuery(
    convexQuery(api.jobs.listUnpaid, {}),
  );

  const createPayment = useMutation(api.payments.create);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  // Find recommended job based on address match
  const recommendedJob =
    checkData.detectedAddress ? findBestAddressMatch(checkData.detectedAddress, unpaidJobs) : null;

  // Split jobs into recommended and others
  const otherJobs = unpaidJobs.filter((job) => job._id !== recommendedJob?._id);

  const handleDone = async () => {
    if (!selectedJobId) return;

    setIsSaving(true);
    try {
      // 1. Upload image to Convex storage
      const uploadUrl = await generateUploadUrl();

      // Convert base64 to blob
      const binaryStr = atob(imageData.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: imageData.mimeType });

      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": imageData.mimeType },
        body: blob,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const { storageId } = await response.json();

      // 2. Create payment record (also updates job status)
      await createPayment({
        jobId: selectedJobId,
        imageId: storageId,
        amount: checkData.amount,
        payerName: checkData.payerName,
        detectedAddress: checkData.detectedAddress,
        date: checkData.date,
      });

      toast.success("Check recorded successfully");
      onOpenChange(false);
      onCancel(); // Reset the hook state
    } catch (error) {
      console.error("Failed to save check:", error);
      toast.error("Failed to save check", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSelectedJobId(null);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md w-[90vw] rounded-4xl p-0 gap-0 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Sticky Header - Green Background */}
        <DialogHeader className="bg-emerald-500 text-white p-6 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <DialogTitle className="text-2xl font-bold text-white">Check Detected</DialogTitle>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-white/80 text-sm">Amount:</span>
              <span className="text-2xl font-bold">{formatCurrency(checkData.amount)}</span>
            </div>

            {checkData.payerName && (
              <div className="flex items-baseline gap-2">
                <span className="text-white/80 text-sm">From:</span>
                <span className="font-medium">{checkData.payerName}</span>
              </div>
            )}

            {checkData.detectedAddress && (
              <div className="flex items-start gap-2">
                <span className="text-white/80 text-sm shrink-0">Address:</span>
                <span className="font-medium text-sm">{checkData.detectedAddress}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Center */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          <h3 className="font-bold text-muted-foreground text-sm uppercase tracking-wider">
            Assign to which job?
          </h3>

          {isLoadingJobs ?
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-muted-foreground" size={24} />
            </div>
          : unpaidJobs.length === 0 ?
            <div className="text-center py-8">
              <p className="text-muted-foreground">No unpaid jobs available</p>
            </div>
          : <div className="space-y-3">
              {/* Recommended job first */}
              {recommendedJob && (
                <JobSelectionCard
                  job={recommendedJob}
                  isSelected={selectedJobId === recommendedJob._id}
                  isRecommended={true}
                  onSelect={() => setSelectedJobId(recommendedJob._id)}
                />
              )}

              {/* Other jobs */}
              {otherJobs.map((job) => (
                <JobSelectionCard
                  key={job._id}
                  job={job}
                  isSelected={selectedJobId === job._id}
                  isRecommended={false}
                  onSelect={() => setSelectedJobId(job._id)}
                />
              ))}
            </div>
          }
        </div>

        {/* Sticky Footer */}
        <DialogFooter className="p-6 border-t border-border bg-background shrink-0">
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
              className="flex-1 py-6 rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDone}
              disabled={!selectedJobId || isSaving || unpaidJobs.length === 0}
              className="flex-1 py-6 rounded-xl font-bold"
            >
              {isSaving ?
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Saving...
                </>
              : "Done"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
